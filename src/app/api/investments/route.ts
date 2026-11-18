import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createInvestmentSchema } from "@/lib/validators/investment";
import { syncInvestmentPrices } from "@/lib/market";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const investments = await db.investment.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(investments);
  } catch (error) {
    console.error("GET /api/investments error:", error);
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
    const parsed = createInvestmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    let investment = await db.investment.create({
      data: {
        ...parsed.data,
        userId: session.user.id,
      },
    });

    // Position cotée : on récupère tout de suite son cours et son historique
    if (investment.ticker) {
      const report = await syncInvestmentPrices(session.user.id, investment.id).catch(() => null);
      if (report?.updated) investment = await db.investment.findUniqueOrThrow({ where: { id: investment.id } });
    }

    return NextResponse.json(investment, { status: 201 });
  } catch (error) {
    console.error("POST /api/investments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
