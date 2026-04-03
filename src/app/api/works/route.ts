import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createWorkSchema } from "@/lib/validators/work";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    const lotId = searchParams.get("lotId");
    const status = searchParams.get("status");

    const works = await db.work.findMany({
      where: {
        userId: session.user.id,
        ...(propertyId ? { propertyId } : {}),
        ...(lotId ? { lotId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        property: { select: { id: true, name: true } },
        lot: { select: { id: true, label: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(works);
  } catch (error) {
    console.error("GET /api/works error:", error);
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
    const parsed = createWorkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Verify property belongs to user if provided
    if (parsed.data.propertyId) {
      const property = await db.property.findUnique({
        where: { id: parsed.data.propertyId, userId: session.user.id },
      });
      if (!property) {
        return NextResponse.json({ error: "Property not found" }, { status: 404 });
      }
    }

    const work = await db.work.create({
      data: {
        ...parsed.data,
        userId: session.user.id,
      },
    });

    return NextResponse.json(work, { status: 201 });
  } catch (error) {
    console.error("POST /api/works error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
