import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.length < 1) {
      return NextResponse.json([]);
    }

    // Use Yahoo Finance autocomplete API (free, no key needed)
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&listsCount=0&enableFuzzyQuery=false`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json([]);
    }

    const data = await res.json();
    const results = (data.quotes || [])
      .filter((q: { quoteType?: string }) =>
        ["EQUITY", "ETF", "MUTUALFUND", "CRYPTOCURRENCY", "INDEX"].includes(q.quoteType || "")
      )
      .map((q: { symbol: string; shortname?: string; longname?: string; quoteType?: string; exchange?: string }) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        type: q.quoteType,
        exchange: q.exchange,
      }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
