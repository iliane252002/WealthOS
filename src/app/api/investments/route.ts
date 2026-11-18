import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { newPositionSchema } from "@/lib/validators/investment";
import { syncInvestmentPrices, isoDate, priceOnDate } from "@/lib/market";
import { recomputeInvestment } from "@/lib/transactions";

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
    const parsed = newPositionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { amount, ...data } = parsed.data;
    const ticker = data.ticker?.trim() || undefined;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(data.purchaseDate ?? "") ? data.purchaseDate! : isoDate(new Date());
    if (date > isoDate(new Date())) {
      return NextResponse.json({ error: "La date d'achat ne peut pas être dans le futur" }, { status: 400 });
    }

    let quantity = data.quantity ?? 1;
    let buyPrice = data.buyPrice;
    let currency = (data.currency || "EUR").toUpperCase();
    let currentPrice = data.currentPrice;

    if (amount !== undefined) {
      // Saisie simple : un montant en euros
      currency = "EUR";
      if (ticker) {
        // Le nombre de parts vient du cours ce jour-là
        let quote;
        try {
          quote = await priceOnDate(ticker, date, "EUR");
        } catch {
          return NextResponse.json(
            { error: `Cours introuvable pour « ${ticker} ». Vérifiez le ticker, ou saisissez la quantité et le prix.` },
            { status: 400 }
          );
        }
        buyPrice = quote.price;
        quantity = amount / quote.price;
      } else {
        // Placement non coté (livret, fonds euros…) : le montant est sa valeur
        buyPrice = amount;
        quantity = 1;
        currentPrice = currentPrice ?? amount;
      }
    }

    let investment = await db.investment.create({
      data: {
        ...data,
        ticker,
        quantity,
        buyPrice: buyPrice!,
        currency,
        currentPrice,
        purchaseDate: date,
        userId: session.user.id,
      },
    });

    // La saisie initiale devient le premier achat de la position
    await db.investmentTransaction.create({
      data: { investmentId: investment.id, type: "BUY", date, quantity, price: buyPrice! },
    });
    await recomputeInvestment(investment.id);
    investment = await db.investment.findUniqueOrThrow({ where: { id: investment.id } });

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
