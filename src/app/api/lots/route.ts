import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createLotSchema } from "@/lib/validators/lot";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    const lots = await db.lot.findMany({
      where: {
        property: { userId: session.user.id },
        ...(propertyId ? { propertyId } : {}),
      },
      include: {
        property: { select: { id: true, name: true } },
        leases: {
          where: { isActive: true },
          include: { tenant: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(lots);
  } catch (error) {
    console.error("GET /api/lots error:", error);
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
    const parsed = createLotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Verify property belongs to user
    const property = await db.property.findUnique({
      where: { id: parsed.data.propertyId, userId: session.user.id },
    });

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const lot = await db.lot.create({
      data: parsed.data,
    });

    return NextResponse.json(lot, { status: 201 });
  } catch (error) {
    console.error("POST /api/lots error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
