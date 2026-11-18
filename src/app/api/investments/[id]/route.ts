import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateInvestmentSchema } from "@/lib/validators/investment";
import { syncInvestmentPrices } from "@/lib/market";

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

    const investment = await db.investment.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!investment) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }

    return NextResponse.json(investment);
  } catch (error) {
    console.error("GET /api/investments/[id] error:", error);
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
    const parsed = updateInvestmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await db.investment.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }

    let investment = await db.investment.update({
      where: { id },
      data: parsed.data,
    });

    // Position cotée : on récupère tout de suite son cours et son historique
    if (investment.ticker) {
      const report = await syncInvestmentPrices(session.user.id, id).catch(() => null);
      if (report?.updated) investment = await db.investment.findUniqueOrThrow({ where: { id } });
    }

    return NextResponse.json(investment);
  } catch (error) {
    console.error("PUT /api/investments/[id] error:", error);
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

    const existing = await db.investment.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }

    await db.investment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/investments/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
