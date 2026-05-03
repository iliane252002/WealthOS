import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// PCG account mapping
// Revenue accounts
const PCG_REVENUE: Record<string, string> = {
  "7061": "Loyers des appartements et maisons",
  "7063": "Charges locatives refacturées",
};
// Expense accounts
const PCG_EXPENSE: Record<string, string> = {
  "6155": "Entretien et réparations",
  "6161": "Assurances",
  "6315": "Taxe foncière",
  "6188": "Frais de gestion locative",
  "6135": "Charges de copropriété",
  "6611": "Intérêts d'emprunts",
  "6061": "Énergie, eau, fluides",
  "6288": "Autres charges",
};

// Map expense categories → PCG account
function expenseToPcg(category: string): keyof typeof PCG_EXPENSE {
  const map: Record<string, string> = {
    MAINTENANCE: "6155",
    INSURANCE: "6161",
    TAX: "6315",
    MANAGEMENT: "6188",
    CONDO_FEES: "6135",
    LOAN: "6611",
    UTILITY: "6061",
    OTHER: "6288",
  };
  return map[category] ?? "6288";
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const sciFilter = searchParams.get("sci") ?? "all"; // "all" | "personal" | SCI name

  // ── Load properties for this user ──────────────────────────────────────
  const properties = await db.property.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      ownershipType: true,
      sciName: true,
      lots: {
        select: {
          id: true,
          label: true,
          leases: {
            select: {
              id: true,
              monthlyRent: true,
              charges: true,
              tenant: { select: { firstName: true, lastName: true } },
              rentEvents: {
                where: {
                  dueDate: { gte: `${year}-01-01`, lte: `${year}-12-31` },
                },
                select: {
                  id: true,
                  dueDate: true,
                  amount: true,
                  paidAmount: true,
                  status: true,
                },
              },
            },
          },
        },
      },
      expenses: {
        where: {
          date: { gte: `${year}-01-01`, lte: `${year}-12-31` },
        },
        select: {
          id: true,
          title: true,
          amount: true,
          category: true,
          date: true,
        },
      },
    },
  });

  // ── Filter by SCI ───────────────────────────────────────────────────────
  const filtered = properties.filter((p) => {
    if (sciFilter === "all") return true;
    if (sciFilter === "personal") return p.ownershipType !== "sci";
    return p.ownershipType === "sci" && p.sciName === sciFilter;
  });

  // ── Build revenue entries (PCG 706x) ───────────────────────────────────
  // Revenue from paid rent events
  const revenueByAccount: Record<string, number> = {};
  const ledgerEntries: Array<{
    account: string;
    label: string;
    description: string;
    date: string;
    amount: number;
    type: "debit" | "credit";
  }> = [];

  // Payment tracking per lease
  const paymentRows: Array<{
    tenantName: string;
    propertyName: string;
    lotLabel: string;
    expected: number;
    received: number;
    outstanding: number;
    events: Array<{ month: string; status: string; amount: number; paidAmount: number }>;
  }> = [];

  for (const property of filtered) {
    for (const lot of property.lots) {
      for (const lease of lot.leases) {
        let expectedTotal = 0;
        let receivedTotal = 0;
        const monthlyEvents: Array<{ month: string; status: string; amount: number; paidAmount: number }> = [];

        for (const event of lease.rentEvents) {
          const rentAccount = "7061";
          const chargeAccount = "7063";
          // Split rent and charges if charges > 0
          const chargesPerEvent = lease.charges ?? 0;
          const rentOnly = event.amount - chargesPerEvent;

          expectedTotal += event.amount;
          receivedTotal += event.paidAmount;

          if (event.paidAmount > 0) {
            // Revenue: rent (7061)
            if (rentOnly > 0) {
              revenueByAccount[rentAccount] = (revenueByAccount[rentAccount] ?? 0) + Math.min(event.paidAmount, rentOnly);
              ledgerEntries.push({
                account: rentAccount,
                label: PCG_REVENUE[rentAccount],
                description: `Loyer ${lot.label} — ${lease.tenant.firstName} ${lease.tenant.lastName}`,
                date: event.dueDate,
                amount: Math.min(event.paidAmount, rentOnly),
                type: "credit",
              });
            }
            // Revenue: charges (7063)
            if (chargesPerEvent > 0 && event.paidAmount > rentOnly) {
              const paidCharges = Math.min(event.paidAmount - rentOnly, chargesPerEvent);
              revenueByAccount[chargeAccount] = (revenueByAccount[chargeAccount] ?? 0) + paidCharges;
              ledgerEntries.push({
                account: chargeAccount,
                label: PCG_REVENUE[chargeAccount],
                description: `Charges ${lot.label} — ${lease.tenant.firstName} ${lease.tenant.lastName}`,
                date: event.dueDate,
                amount: paidCharges,
                type: "credit",
              });
            }
          }

          monthlyEvents.push({
            month: event.dueDate.slice(0, 7), // YYYY-MM
            status: event.status,
            amount: event.amount,
            paidAmount: event.paidAmount,
          });
        }

        if (lease.rentEvents.length > 0) {
          paymentRows.push({
            tenantName: `${lease.tenant.firstName} ${lease.tenant.lastName}`,
            propertyName: property.name,
            lotLabel: lot.label,
            expected: expectedTotal,
            received: receivedTotal,
            outstanding: expectedTotal - receivedTotal,
            events: monthlyEvents.sort((a, b) => a.month.localeCompare(b.month)),
          });
        }
      }
    }
  }

  // ── Build expense entries (PCG 6xxx) ───────────────────────────────────
  const expenseByAccount: Record<string, number> = {};
  for (const property of filtered) {
    for (const expense of property.expenses) {
      const account = expenseToPcg(expense.category);
      expenseByAccount[account] = (expenseByAccount[account] ?? 0) + expense.amount;
      ledgerEntries.push({
        account,
        label: PCG_EXPENSE[account] ?? "Autres charges",
        description: expense.title,
        date: expense.date,
        amount: expense.amount,
        type: "debit",
      });
    }
  }

  // ── Totals ─────────────────────────────────────────────────────────────
  const totalRevenue = Object.values(revenueByAccount).reduce((a, b) => a + b, 0);
  const totalExpenses = Object.values(expenseByAccount).reduce((a, b) => a + b, 0);
  const netResult = totalRevenue - totalExpenses;

  // ── Revenue lines ──────────────────────────────────────────────────────
  const revenueLines = Object.entries(PCG_REVENUE)
    .map(([account, label]) => ({ account, label, amount: revenueByAccount[account] ?? 0 }))
    .filter((l) => l.amount > 0);

  // ── Expense lines ──────────────────────────────────────────────────────
  const expenseLines = Object.entries(PCG_EXPENSE)
    .map(([account, label]) => ({ account, label, amount: expenseByAccount[account] ?? 0 }))
    .filter((l) => l.amount > 0);

  // ── List of distinct SCIs ──────────────────────────────────────────────
  const scis = Array.from(
    new Set(
      properties
        .filter((p) => p.ownershipType === "sci" && p.sciName)
        .map((p) => p.sciName as string)
    )
  );

  // Sort ledger by date
  ledgerEntries.sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    year,
    sciFilter,
    scis,
    totalRevenue,
    totalExpenses,
    netResult,
    revenueLines,
    expenseLines,
    ledger: ledgerEntries,
    paymentTracking: paymentRows,
  });
}
