import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateLotSchema } from "@/lib/validators/lot";

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

    const lot = await db.lot.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, name: true, userId: true } },
        leases: {
          include: {
            tenant: true,
            rentEvents: true,
            coTenants: { include: { tenant: true } },
          },
        },
        documents: true,
        works: true,
      },
    });

    if (!lot || lot.property.userId !== session.user.id) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    return NextResponse.json(lot);
  } catch (error) {
    console.error("GET /api/lots/[id] error:", error);
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
    const parsed = updateLotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await db.lot.findUnique({
      where: { id },
      include: { property: { select: { userId: true } } },
    });

    if (!existing || existing.property.userId !== session.user.id) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    const lot = await db.lot.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(lot);
  } catch (error) {
    console.error("PUT /api/lots/[id] error:", error);
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

    const existing = await db.lot.findUnique({
      where: { id },
      include: { property: { select: { userId: true } } },
    });

    if (!existing || existing.property.userId !== session.user.id) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    await db.lot.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/lots/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
