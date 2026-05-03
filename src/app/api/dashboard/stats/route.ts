import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const properties = await db.property.findMany({
    where: { userId },
    include: { lots: true },
  });

  const investments = await db.investment.findMany({
    where: { userId },
  });

  const totalRealEstateValue = properties.reduce(
    (sum, p) => sum + (p.currentValue || 0),
    0
  );

  const totalInvestmentValue = investments.reduce(
    (sum, inv) => sum + (inv.currentPrice || inv.buyPrice) * (inv.quantity || 1),
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
  const lateRentEvents = await db.rentEvent.findMany({
    where: {
      status: "LATE",
      lease: { lot: { property: { userId } } },
    },
    include: {
      lease: {
        include: {
          lot: { include: { property: { select: { name: true } } } },
          tenant: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { dueDate: "desc" },
    take: 10,
  });

  // Properties missing key data
  const propertiesMissingType = properties.filter((p) => !p.type).length;
  const propertiesMissingValue = properties.filter((p) => !p.currentValue).length;
  const vacantLots = allLots.filter((l) => l.status === "VACANT").length;

  // Total outstanding (unpaid late rents)
  const allLateRents = await db.rentEvent.findMany({
    where: {
      status: "LATE",
      lease: { lot: { property: { userId } } },
    },
  });
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
