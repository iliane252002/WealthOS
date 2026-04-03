import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Occupancy score (30 pts)
  const properties = await db.property.findMany({
    where: { userId },
    include: { lots: true },
  });
  const allLots = properties.flatMap((p) => p.lots);
  const totalLots = allLots.length;
  const occupiedLots = allLots.filter((l) => l.status === "OCCUPIED").length;
  const occupancyScore = totalLots > 0 ? Math.round((occupiedLots / totalLots) * 30) : 0;

  // Income regularity (25 pts) - last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);

  const recentRents = await db.rentEvent.findMany({
    where: {
      dueDate: { gte: sixMonthsAgoStr },
      lease: { lot: { property: { userId } } },
    },
  });

  const totalDue = recentRents.length;
  const paidOnTime = recentRents.filter((r) => r.status === "PAID").length;
  const incomeRegularity = totalDue > 0 ? Math.round((paidOnTime / totalDue) * 25) : 0;

  // Diversification (20 pts)
  const investments = await db.investment.findMany({
    where: { userId },
    select: { assetType: true },
  });
  const assetTypes = new Set(investments.map((i) => i.assetType));
  if (properties.length > 0) assetTypes.add("REAL_ESTATE");
  const typeCount = assetTypes.size;
  const diversification = Math.min(typeCount * 4, 20);

  // Growth trend (15 pts)
  const totalAcquisition = properties.reduce((s, p) => s + (p.acquisitionPrice || 0), 0);
  const totalCurrent = properties.reduce((s, p) => s + (p.currentValue || p.acquisitionPrice || 0), 0);
  let growthTrend = 0;
  if (totalAcquisition > 0) {
    const growthPct = ((totalCurrent - totalAcquisition) / totalAcquisition) * 100;
    if (growthPct > 10) growthTrend = 15;
    else if (growthPct > 5) growthTrend = 10;
    else if (growthPct > 0) growthTrend = 5;
  }

  // Base (10 pts)
  const base = 10;

  const total = occupancyScore + incomeRegularity + diversification + growthTrend + base;

  let grade: string;
  if (total >= 80) grade = "A";
  else if (total >= 65) grade = "B";
  else if (total >= 50) grade = "C";
  else if (total >= 35) grade = "D";
  else grade = "F";

  return NextResponse.json({
    occupancyScore,
    incomeRegularity,
    diversification,
    growthTrend,
    base,
    total,
    grade,
  });
}
