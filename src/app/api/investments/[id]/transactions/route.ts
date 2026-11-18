import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { amountTransactionSchema, createTransactionSchema } from "@/lib/validators/transaction";
import { computePosition, recomputeInvestment } from "@/lib/transactions";
import { isoDate, priceOnDate, syncInvestmentPrices } from "@/lib/market";

type Params = { params: Promise<{ id: string }> };

/** Liste des opérations d'une position, avec quantité détenue, PRU et plus-value réalisée. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const investment = await db.investment.findUnique({ where: { id, userId: session.user.id } });
    if (!investment) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }
    const txs = await db.investmentTransaction.findMany({ where: { investmentId: id } });
    return NextResponse.json(computePosition(txs));
  } catch (error) {
    console.error("GET /api/investments/[id]/transactions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const investment = await db.investment.findUnique({ where: { id, userId: session.user.id } });
    if (!investment) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }

    const body = await request.json();

    // Saisie simple (montant + date) : on déduit quantité et prix du cours ce jour-là
    if (body && body.amount !== undefined && body.quantity === undefined) {
      const simple = amountTransactionSchema.safeParse(body);
      if (!simple.success) {
        return NextResponse.json({ error: simple.error.flatten() }, { status: 400 });
      }
      if (simple.data.date > isoDate(new Date())) {
        return NextResponse.json({ error: "La date ne peut pas être dans le futur" }, { status: 400 });
      }
      let price: number;
      if (investment.ticker) {
        try {
          price = (await priceOnDate(investment.ticker, simple.data.date, investment.currency || "EUR")).price;
        } catch {
          return NextResponse.json(
            { error: `Cours introuvable pour « ${investment.ticker} » à cette date. Saisissez la quantité et le prix.` },
            { status: 400 }
          );
        }
      } else {
        // Placement non coté : on garde la valeur unitaire actuelle
        price = investment.currentPrice ?? investment.buyPrice;
      }
      const { amount, ...rest } = simple.data;
      body.quantity = amount / price;
      body.price = price;
      body.type = rest.type;
      body.date = rest.date;
      body.fees = rest.fees;
      delete body.amount;
    }

    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // On refuse une vente qui ferait passer la quantité détenue sous zéro
    const existing = await db.investmentTransaction.findMany({ where: { investmentId: id } });
    const check = computePosition([
      ...existing,
      { id: "new", ...parsed.data, fees: parsed.data.fees ?? 0, createdAt: new Date() },
    ]);
    if (check.error) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const tx = await db.investmentTransaction.create({
      data: { ...parsed.data, investmentId: id },
    });
    await recomputeInvestment(id);

    // Un achat plus ancien que l'historique connu : on complète les cours
    if (investment.ticker) await syncInvestmentPrices(session.user.id, id).catch(() => null);

    return NextResponse.json(tx, { status: 201 });
  } catch (error) {
    console.error("POST /api/investments/[id]/transactions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
