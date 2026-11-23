import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncRents, todayIso, isOverdue } from "@/lib/rents";

// Vue d'ensemble des loyers : toutes les échéances impayées et celles du mois en cours.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    await syncRents(userId);
  } catch (error) {
    console.error("syncRents error:", error);
  }

  const today = todayIso();
  const month = today.slice(0, 7);

  const events = await db.rentEvent.findMany({
    where: {
      lease: { lot: { property: { userId } } },
      OR: [
        { status: { not: "PAID" }, dueDate: { lt: today } },
        { dueDate: { gte: `${month}-01`, lte: `${month}-31` } },
      ],
    },
    include: {
      lease: {
        select: {
          id: true,
          isActive: true,
          tenant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          lot: { select: { id: true, label: true, property: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const shape = (e: (typeof events)[number]) => ({
    id: e.id,
    dueDate: e.dueDate,
    amount: e.amount,
    paidAmount: e.paidAmount,
    paidDate: e.paidDate,
    status: e.status,
    remaining: Math.max(0, e.amount - e.paidAmount),
    tenant: e.lease.tenant,
    lot: { id: e.lease.lot.id, label: e.lease.lot.label },
    property: e.lease.lot.property,
    leaseActive: e.lease.isActive,
  });

  const overdue = events.filter((e) => isOverdue(e, today)).map(shape);
  const thisMonth = events.filter((e) => e.dueDate.startsWith(month)).map(shape);

  return NextResponse.json({
    today,
    month,
    overdue,
    thisMonth,
    totals: {
      overdueAmount: overdue.reduce((s, e) => s + e.remaining, 0),
      overdueCount: overdue.length,
      overdueTenants: new Set(overdue.map((e) => e.tenant.id)).size,
      monthExpected: thisMonth.reduce((s, e) => s + e.amount, 0),
      monthCollected: thisMonth.reduce((s, e) => s + Math.min(e.paidAmount, e.amount), 0),
    },
  });
}
