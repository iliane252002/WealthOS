import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isoDate, priceOnDate } from "@/lib/market";

// Cours d'un symbole à une date, en euros (aperçu pendant la saisie d'une position)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim();
  const date = searchParams.get("date") ?? isoDate(new Date());
  const currency = searchParams.get("currency") ?? "EUR";
  if (!symbol || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }
  try {
    return NextResponse.json(await priceOnDate(symbol, date, currency));
  } catch (error) {
    console.error(`GET /api/stocks/quote ${symbol} ${date}:`, error);
    return NextResponse.json({ error: `Cours introuvable pour ${symbol}` }, { status: 404 });
  }
}
