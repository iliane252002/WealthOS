import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createLeaseSchema } from "@/lib/validators/lease";

function getRentEventStatus(dueDate: string, notifyDaysBefore: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "LATE";
  if (diffDays <= notifyDaysBefore) return "DUE";
  return "PENDING";
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");
    const tenantId = searchParams.get("tenantId");
    const isActive = searchParams.get("isActive");

    const leases = await db.lease.findMany({
      where: {
        lot: { property: { userId: session.user.id } },
        ...(lotId ? { lotId } : {}),
        ...(tenantId ? { tenantId } : {}),
        ...(isActive !== null ? { isActive: isActive === "true" } : {}),
      },
      include: {
        lot: {
          include: {
            property: { select: { id: true, name: true } },
          },
        },
        tenant: true,
        rentEvents: { orderBy: { dueDate: "desc" }, take: 3 },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(leases);
  } catch (error) {
    console.error("GET /api/leases error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createLeaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Verify lot belongs to user
    const lot = await db.lot.findUnique({
      where: { id: parsed.data.lotId },
      include: { property: { select: { userId: true } } },
    });

    if (!lot || lot.property.userId !== session.user.id) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    // Verify tenant belongs to user
    const tenant = await db.tenant.findUnique({
      where: { id: parsed.data.tenantId, userId: session.user.id },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { monthlyRent, charges, paymentDayOfMonth, notifyDaysBefore, startDate } = parsed.data;
    const totalAmount = monthlyRent + charges;

    // Generate rent events from start date to current month
    const start = new Date(startDate);
    const now = new Date();
    const rentEvents: Array<{
      dueDate: string;
      amount: number;
      status: string;
    }> = [];

    const currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    while (currentMonth <= endMonth) {
      const year = currentMonth.getFullYear();
      const month = String(currentMonth.getMonth() + 1).padStart(2, "0");
      const day = String(paymentDayOfMonth).padStart(2, "0");
      const dueDate = `${year}-${month}-${day}`;

      const status = getRentEventStatus(dueDate, notifyDaysBefore);

      rentEvents.push({
        dueDate,
        amount: totalAmount,
        status,
      });

      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    // Create lease, update lot status, and create rent events in a transaction
    const lease = await db.$transaction(async (tx) => {
      const newLease = await tx.lease.create({
        data: parsed.data,
      });

      // Set lot to OCCUPIED
      await tx.lot.update({
        where: { id: parsed.data.lotId },
        data: { status: "OCCUPIED" },
      });

      // Create rent events
      if (rentEvents.length > 0) {
        await tx.rentEvent.createMany({
          data: rentEvents.map((re) => ({
            leaseId: newLease.id,
            ...re,
          })),
        });
      }

      return newLease;
    });

    const leaseWithRelations = await db.lease.findUnique({
      where: { id: lease.id },
      include: {
        lot: true,
        tenant: true,
        rentEvents: { orderBy: { dueDate: "asc" } },
      },
    });

    return NextResponse.json(leaseWithRelations, { status: 201 });
  } catch (error) {
    console.error("POST /api/leases error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
