import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateLeaseSchema } from "@/lib/validators/lease";

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

    const lease = await db.lease.findUnique({
      where: { id },
      include: {
        lot: {
          include: {
            property: { select: { id: true, name: true, userId: true } },
          },
        },
        tenant: true,
        rentEvents: { orderBy: { dueDate: "desc" } },
      },
    });

    if (!lease || lease.lot.property.userId !== session.user.id) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    return NextResponse.json(lease);
  } catch (error) {
    console.error("GET /api/leases/[id] error:", error);
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
    const parsed = updateLeaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await db.lease.findUnique({
      where: { id },
      include: {
        lot: {
          include: { property: { select: { userId: true } } },
        },
      },
    });

    if (!existing || existing.lot.property.userId !== session.user.id) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    const lease = await db.lease.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(lease);
  } catch (error) {
    console.error("PUT /api/leases/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.lease.findUnique({
      where: { id },
      include: {
        lot: {
          include: { property: { select: { userId: true } } },
        },
      },
    });

    if (!existing || existing.lot.property.userId !== session.user.id) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      await tx.lease.delete({ where: { id } });
      // Set lot back to VACANT
      await tx.lot.update({
        where: { id: existing.lotId },
        data: { status: "VACANT" },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/leases/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
