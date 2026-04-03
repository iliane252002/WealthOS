import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const activeLeases = await db.lease.findMany({
    where: { isActive: true },
  });

  let generated = 0;

  for (const lease of activeLeases) {
    const day = Math.min(lease.paymentDayOfMonth, 28);
    const dueDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const existing = await db.rentEvent.findUnique({
      where: { leaseId_dueDate: { leaseId: lease.id, dueDate } },
    });

    if (!existing) {
      const amount = lease.monthlyRent + lease.charges;
      const dueDateObj = new Date(dueDate);
      let status = "PENDING";
      if (now > dueDateObj) status = "LATE";
      else {
        const daysUntilDue = Math.ceil((dueDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue <= lease.notifyDaysBefore) status = "DUE";
      }

      await db.rentEvent.create({
        data: { leaseId: lease.id, dueDate, amount, status },
      });
      generated++;
    }
  }

  return NextResponse.json({ generated });
}
