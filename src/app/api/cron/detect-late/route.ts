import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Find all PENDING or DUE rent events past due date
  const lateEvents = await db.rentEvent.findMany({
    where: {
      status: { in: ["PENDING", "DUE"] },
      dueDate: { lt: today },
    },
    include: {
      lease: {
        include: {
          lot: { include: { property: { select: { name: true, userId: true } } } },
          tenant: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  let updated = 0;

  for (const event of lateEvents) {
    await db.rentEvent.update({
      where: { id: event.id },
      data: { status: "LATE" },
    });

    // Create notification
    const userId = event.lease.lot.property.userId;
    await db.notification.create({
      data: {
        userId,
        type: "RENT_LATE",
        title: "Late Rent Payment",
        message: `Rent of ${event.amount} EUR is late for ${event.lease.lot.property.name} - ${event.lease.lot.label} (${event.lease.tenant.firstName} ${event.lease.tenant.lastName})`,
        link: `/properties/${event.lease.lot.propertyId}`,
      },
    });

    updated++;
  }

  return NextResponse.json({ updated });
}
