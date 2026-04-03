import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const leaseId = searchParams.get("leaseId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {
      lease: {
        lot: {
          property: { userId: session.user.id },
        },
      },
    };

    if (status) where.status = status;
    if (leaseId) where.leaseId = leaseId;

    if (from || to) {
      where.dueDate = {};
      if (from) (where.dueDate as Record<string, string>).gte = from;
      if (to) (where.dueDate as Record<string, string>).lte = to;
    }

    const rentEvents = await db.rentEvent.findMany({
      where,
      include: {
        lease: {
          include: {
            tenant: { select: { id: true, firstName: true, lastName: true } },
            lot: {
              include: {
                property: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { dueDate: "desc" },
    });

    return NextResponse.json(rentEvents);
  } catch (error) {
    console.error("GET /api/rent-events error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
