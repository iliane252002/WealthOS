import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createPropertySchema } from "@/lib/validators/property";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const properties = await db.property.findMany({
      where: { userId: session.user.id },
      include: {
        lots: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = properties.map((property) => {
      const totalLots = property.lots.length;
      const occupiedLots = property.lots.filter((l) => l.status === "OCCUPIED").length;
      const vacantLots = totalLots - occupiedLots;
      const occupancyRate = totalLots > 0 ? occupiedLots / totalLots : 0;

      return {
        ...property,
        _count: { lots: totalLots },
        occupiedLots,
        vacantLots,
        occupancyRate,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/properties error:", error);
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
    const parsed = createPropertySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const property = await db.property.create({
      data: {
        ...parsed.data,
        userId: session.user.id,
      },
    });

    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    console.error("POST /api/properties error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
