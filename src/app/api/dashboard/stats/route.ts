import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { storedRateToEur } from "@/lib/market";
import { effectiveValue } from "@/lib/estimation";
import { syncRents, todayIso } from "@/lib/rents";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  await syncRents(userId).catch((e) => console.error("syncRents error:", e));
  const today = todayIso();

  const properties = await db.property.findMany({
    where: { userId },
    include: { lots: true },
  });

  const investments = await db.investment.findMany({
    where: { userId },
  });

  const totalRealEstateValue = properties.reduce(
    (sum, p) => sum + (effectiveValue(p) ?? 0),
    0
  );

  // Valeur en euros : les positions en devises sont converties au dernier taux connu
  const rates = new Map<string, number>();
  for (const inv of investments) {
    const c = (inv.currency || "EUR").toUpperCase();
    if (!rates.has(c)) rates.set(c, await storedRateToEur(c));
  }
  const totalInvestmentValue = investments.reduce(
    (sum, inv) =>
      sum + (inv.currentPrice || inv.buyPrice) * (inv.quantity ?? 1) * (rates.get((inv.currency || "EUR").toUpperCase()) ?? 1),
    0
  );

  const totalNetWorth = totalRealEstateValue + totalInvestmentValue;

  // Occupancy
  const allLots = properties.flatMap((p) => p.lots);
  const totalLots = allLots.length;
  const occupiedLots = allLots.filter((l) => l.status === "OCCUPIED").length;
  const occupancyRate = totalLots > 0 ? occupiedLots / totalLots : 0;

  // Active leases for expected income
  const activeLeases = await db.lease.findMany({
    where: {
      isActive: true,
      lot: { property: { userId } },
    },
  });

  const totalExpectedMonthlyIncome = activeLeases.reduce(
    (sum, l) => sum + l.monthlyRent + l.charges,
    0
  );

  // This month's collected rents
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;

  const paidThisMonth = await db.rentEvent.findMany({
    where: {
      status: "PAID",
      dueDate: { gte: monthStart, lte: monthEnd },
      lease: { lot: { property: { userId } } },
    },
  });

  const totalCollectedThisMonth = paidThisMonth.reduce(
    (sum, re) => sum + re.paidAmount,
    0
  );

  // Late payments
  // Impayé : échéance passée, pas soldée (en retard ou partiellement payée)
  const overdueWhere = {
    status: { not: "PAID" },
    dueDate: { lt: today },
    lease: { lot: { property: { userId } } },
  };
  const lateRentEvents = await db.rentEvent.findMany({
    where: overdueWhere,
    include: {
      lease: {
        include: {
          lot: { include: { property: { select: { name: true, id: true } } } },
          tenant: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { dueDate: "desc" },
    take: 10,
  });

  // Properties missing key data
  const propertiesMissingType = properties.filter((p) => !p.type).length;
  const propertiesMissingValue = properties.filter((p) => effectiveValue(p) == null).length;
  const vacantLots = allLots.filter((l) => l.status === "VACANT").length;

  // Total outstanding (unpaid late rents)
  const allLateRents = (await db.rentEvent.findMany({ where: overdueWhere })).filter((re) => re.paidAmount < re.amount);
  const totalOutstanding = allLateRents.reduce((sum, re) => sum + (re.amount - re.paidAmount), 0);

  return NextResponse.json({
    totalRealEstateValue,
    totalInvestmentValue,
    totalNetWorth,
    totalExpectedMonthlyIncome,
    totalCollectedThisMonth,
    latePaymentsCount: allLateRents.length,
    occupancyRate,
    totalProperties: properties.length,
    totalLots,
    lateRentEvents,
    totalOutstanding,
    propertiesMissingType,
    propertiesMissingValue,
    vacantLots,
  });
}
