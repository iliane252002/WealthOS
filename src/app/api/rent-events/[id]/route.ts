import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const updateRentEventSchema = z.object({
  status: z.enum(["PENDING", "DUE", "PAID", "LATE", "PARTIALLY_PAID"]).optional(),
  paidAmount: z.number().min(0).optional(),
  paidDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const rentEvent = await db.rentEvent.findUnique({
      where: { id },
      include: {
        lease: {
          include: {
            tenant: true,
            lot: {
              include: {
                property: { select: { id: true, name: true, userId: true } },
              },
            },
          },
        },
      },
    });

    if (!rentEvent || rentEvent.lease.lot.property.userId !== session.user.id) {
      return NextResponse.json({ error: "Rent event not found" }, { status: 404 });
    }

    return NextResponse.json(rentEvent);
  } catch (error) {
    console.error("GET /api/rent-events/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateRentEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await db.rentEvent.findUnique({
      where: { id },
      include: {
        lease: {
          include: {
            lot: {
              include: { property: { select: { userId: true } } },
            },
          },
        },
      },
    });

    if (!existing || existing.lease.lot.property.userId !== session.user.id) {
      return NextResponse.json({ error: "Rent event not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { ...parsed.data };

    // Auto-determine status based on payment
    if (parsed.data.paidAmount !== undefined) {
      if (parsed.data.paidAmount >= existing.amount) {
        updateData.status = "PAID";
        if (!parsed.data.paidDate) {
          updateData.paidDate = new Date().toISOString().split("T")[0];
        }
      } else if (parsed.data.paidAmount > 0) {
        updateData.status = "PARTIALLY_PAID";
      }
    }

    const rentEvent = await db.rentEvent.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(rentEvent);
  } catch (error) {
    console.error("PUT /api/rent-events/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
