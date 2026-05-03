import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const today = new Date().toISOString().slice(0, 10);

  const lateEvents = await db.rentEvent.findMany({
    where: {
      status: { in: ["PENDING", "DUE"] },
      dueDate: { lt: today },
      lease: {
        lot: {
          property: {
            userId,
          },
        },
      },
    },
    include: {
      lease: {
        include: {
          lot: { include: { property: { select: { name: true, id: true } } } },
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

    await db.notification.create({
      data: {
        userId,
        type: "RENT_LATE",
        title: "Late Rent Payment",
        message: `Rent of ${event.amount} EUR is late for ${event.lease.lot.property.name} - ${event.lease.lot.label} (${event.lease.tenant.firstName} ${event.lease.tenant.lastName})`,
        link: `/properties/${event.lease.lot.property.id}/lots/${event.lease.lot.id}`,
      },
    });

    updated++;
  }

  return NextResponse.json({ updated });
}
