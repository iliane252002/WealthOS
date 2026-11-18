import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fxSymbol, historyStart, isoDate } from "@/lib/market";
import { computePosition, stateAt, type Tx } from "@/lib/transactions";

const RANGES: Record<string, number | null> = { "1M": 1, "6M": 6, "1Y": 12, "5Y": 60, MAX: null };

type Series = { dates: string[]; closes: number[]; currency: string };

/** Dernier cours connu à une date donnée (report du cours précédent les jours sans cotation). */
function valueAt(series: Series | undefined, date: string): number | null {
  if (!series || series.dates.length === 0) return null;
  let lo = 0;
  let hi = series.dates.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series.dates[mid] <= date) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found >= 0 ? series.closes[found] : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rangeKey = new URL(request.url).searchParams.get("range") ?? "1Y";
    const months = RANGES[rangeKey] === undefined ? 12 : RANGES[rangeKey];

    const investments = await db.investment.findMany({
      where: { userId: session.user.id },
      include: { transactions: true },
    });

    // Opérations de chaque position (une position sans opération = un achat unique)
    const positionsState = new Map(
      investments.map((inv) => {
        const txs: Tx[] =
          inv.transactions.length > 0
            ? inv.transactions
            : [{ id: inv.id, type: "BUY", date: historyStart(inv.purchaseDate), quantity: inv.quantity ?? 1, price: inv.buyPrice, fees: 0 }];
        return [inv.id, computePosition(txs)];
      })
    );
    const today = isoDate(new Date());

    let start: string;
    if (months === null) {
      start = [...positionsState.values()].map((p) => p.firstDate ?? today).sort()[0] ?? today;
    } else {
      const d = new Date();
      d.setUTCMonth(d.getUTCMonth() - months);
      start = isoDate(d);
    }

    // Cours des positions cotées + taux de change nécessaires
    const tickers = [...new Set(investments.map((i) => i.ticker?.trim()).filter((t): t is string => !!t))];
    const rows = await db.priceHistory.findMany({
      where: { symbol: { in: tickers }, date: { lte: today } },
      orderBy: { date: "asc" },
    });
    const series = new Map<string, Series>();
    for (const r of rows) {
      const s = series.get(r.symbol) ?? { dates: [], closes: [], currency: r.currency };
      s.dates.push(r.date);
      s.closes.push(r.close);
      s.currency = r.currency;
      series.set(r.symbol, s);
    }

    const currencies = new Set<string>();
    for (const inv of investments) currencies.add((inv.currency || "EUR").toUpperCase());
    for (const s of series.values()) currencies.add(s.currency);
    currencies.delete("EUR");
    const fxRows = await db.priceHistory.findMany({
      where: { symbol: { in: [...currencies].map(fxSymbol) } },
      orderBy: { date: "asc" },
    });
    const fx = new Map<string, Series>();
    for (const r of fxRows) {
      const s = fx.get(r.symbol) ?? { dates: [], closes: [], currency: "EUR" };
      s.dates.push(r.date);
      s.closes.push(r.close);
      fx.set(r.symbol, s);
    }
    const toEur = (currency: string, date: string) => {
      const c = currency.toUpperCase();
      if (c === "EUR") return 1;
      const s = fx.get(fxSymbol(c));
      return valueAt(s, date) ?? (s ? s.closes[s.closes.length - 1] : null);
    };

    // Axe des dates : toutes les séances des positions cotées sur la période
    const dateSet = new Set<string>();
    for (const t of tickers) for (const d of series.get(t)?.dates ?? []) if (d >= start) dateSet.add(d);
    if (dateSet.size > 0) dateSet.add(today);
    const dates = [...dateSet].sort();

    const lastUpdate = investments
      .map((i) => i.priceUpdatedAt)
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const positions = investments.map((inv) => {
      const ticker = inv.ticker?.trim() || null;
      const s = ticker ? series.get(ticker) : undefined;
      const invCurrency = (inv.currency || "EUR").toUpperCase();
      const state = positionsState.get(inv.id)!;
      const held = state.firstDate;
      const points: { date: string; price: number }[] = [];
      if (s) {
        for (const d of dates) {
          if (held && d < held) continue;
          const close = valueAt(s, d);
          if (close == null) continue;
          let price = close;
          if (s.currency !== invCurrency) {
            const a = toEur(s.currency, d);
            const b = toEur(invCurrency, d);
            if (a == null || b == null) continue;
            price = (close * a) / b;
          }
          points.push({ date: d, price: Math.round(price * 10000) / 10000 });
        }
      }
      const first = points[0]?.price;
      const last = points[points.length - 1]?.price;
      return {
        id: inv.id,
        name: inv.name,
        ticker,
        currency: invCurrency,
        quoteCurrency: s?.currency ?? null,
        quantity: state.quantity,
        buyPrice: inv.buyPrice,
        purchaseDate: held,
        realized: state.realized,
        closed: state.quantity === 0,
        trades: state.transactions.map((t) => ({ date: t.date, type: t.type, quantity: t.quantity, price: t.price })),
        tracked: !!s && s.dates.length > 0,
        series: points,
        rangeChangePct: first && last ? ((last - first) / first) * 100 : null,
      };
    });

    // Courbe du portefeuille en euros : valeur et montant investi à chaque séance
    const byId = new Map(positions.map((p) => [p.id, p]));
    const posSeries = new Map<string, Series>(
      positions.map((p) => [p.id, { dates: p.series.map((x) => x.date), closes: p.series.map((x) => x.price), currency: p.currency }])
    );
    const points = dates.map((d) => {
      let value = 0;
      let invested = 0;
      let netFlow = 0;
      for (const inv of investments) {
        const p = byId.get(inv.id)!;
        const st = stateAt(positionsState.get(inv.id)!.transactions, d);
        if (st.held === 0 && st.netFlow === 0) continue;
        const rate = toEur(p.currency, d) ?? 1;
        invested += st.costBasis * rate;
        netFlow += st.netFlow * rate;
        if (st.held === 0) continue;
        if (p.tracked) {
          const price = valueAt(posSeries.get(p.id), d);
          value += st.held * (price ?? inv.buyPrice) * rate;
        } else {
          // Placement non coté (livret, fonds euros…) : valeur saisie à la main
          value += st.held * (inv.currentPrice ?? inv.buyPrice) * rate;
        }
      }
      return {
        date: d,
        value: Math.round(value * 100) / 100,
        invested: Math.round(invested * 100) / 100,
        netFlow: Math.round(netFlow * 100) / 100,
      };
    });

    // Plus-values réalisées (ventes), converties en euros au dernier taux connu
    const realized = positions.reduce((sum, p) => sum + p.realized * (toEur(p.currency, today) ?? 1), 0);

    return NextResponse.json({
      range: rangeKey in RANGES ? rangeKey : "1Y",
      start,
      lastUpdate: lastUpdate ? isoDate(lastUpdate) : null,
      points,
      positions,
      realized: Math.round(realized * 100) / 100,
    });
  } catch (error) {
    console.error("GET /api/investments/history error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
