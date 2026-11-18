import { db } from "@/lib/db";

/**
 * Cours de marché via l'API "chart" de Yahoo Finance (gratuite, sans clé, non officielle).
 * Tout passe par fetchDailyCloses() : pour changer de fournisseur (EODHD, Twelve Data…),
 * il suffit de réécrire cette fonction.
 */

export type DailyClose = { date: string; close: number };

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/";
const DAY = 24 * 60 * 60 * 1000;

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  return isoDate(new Date(new Date(date + "T00:00:00Z").getTime() + days * DAY));
}

/** Symbole Yahoo du taux de change qui convertit `currency` en euros (ex. USD → "USDEUR=X"). */
export function fxSymbol(currency: string) {
  return `${currency.toUpperCase()}EUR=X`;
}

/** Récupère les cours de clôture quotidiens entre deux dates (incluses). */
export async function fetchDailyCloses(
  symbol: string,
  from: string,
  to: string = isoDate(new Date())
): Promise<{ currency: string; closes: DailyClose[] }> {
  const period1 = Math.floor(new Date(from + "T00:00:00Z").getTime() / 1000);
  const period2 = Math.floor(new Date(to + "T23:59:59Z").getTime() / 1000);
  const url = `${YAHOO_CHART}${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=div,split`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Cours indisponibles pour ${symbol} (HTTP ${res.status})`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`Symbole inconnu : ${symbol}`);

  const meta = result.meta ?? {};
  const offset: number = meta.gmtoffset ?? 0;
  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  // Les places de Londres cotent en pence ("GBp") : on ramène en livres.
  let currency: string = meta.currency ?? "EUR";
  let factor = 1;
  if (currency === "GBp" || currency === "GBX") {
    currency = "GBP";
    factor = 0.01;
  }

  const byDate = new Map<string, number>();
  timestamps.forEach((ts, i) => {
    const c = closes[i];
    if (c == null || !Number.isFinite(c)) return;
    // Date locale de la place de cotation
    byDate.set(isoDate(new Date((ts + offset) * 1000)), c * factor);
  });

  return {
    currency,
    closes: [...byDate.entries()].map(([date, close]) => ({ date, close })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/**
 * Met à jour l'historique d'un symbole en base, depuis `from` (ou depuis le dernier cours connu).
 * Renvoie le dernier cours connu et sa devise.
 */
export async function syncSymbol(symbol: string, from: string) {
  const last = await db.priceHistory.findFirst({ where: { symbol }, orderBy: { date: "desc" } });
  const first = await db.priceHistory.findFirst({ where: { symbol }, orderBy: { date: "asc" } });

  const today = isoDate(new Date());
  const ranges: [string, string][] = [];
  if (!first) {
    ranges.push([from, today]);
  } else {
    // Historique manquant avant le premier cours connu (ex. date d'achat plus ancienne)
    if (from < first.date) ranges.push([from, addDays(first.date, -1)]);
    // On recharge les derniers jours : la séance du jour peut avoir été enregistrée en cours de journée
    ranges.push([addDays(last!.date, -3), today]);
  }

  let currency = last?.currency ?? "EUR";
  for (const [start, end] of ranges) {
    if (start > end) continue;
    const data = await fetchDailyCloses(symbol, start, end);
    currency = data.currency;
    // Les cours déjà connus sont remplacés (la clôture du jour peut changer jusqu'au soir)
    await db.$transaction([
      db.priceHistory.deleteMany({ where: { symbol, date: { gte: start, lte: end } } }),
      db.priceHistory.createMany({
        data: data.closes.map((c) => ({ symbol, date: c.date, close: c.close, currency: data.currency })),
        skipDuplicates: true,
      }),
    ]);
  }

  const latest = await db.priceHistory.findFirst({ where: { symbol }, orderBy: { date: "desc" } });
  return latest ? { close: latest.close, date: latest.date, currency: latest.currency ?? currency } : null;
}

/** Taux de conversion d'une devise vers l'euro à la date la plus récente connue. */
async function latestFxToEur(currency: string, from: string) {
  if (currency === "EUR") return 1;
  const fx = await syncSymbol(fxSymbol(currency), from);
  if (!fx) throw new Error(`Taux de change ${currency}/EUR indisponible`);
  return fx.close;
}

const DEFAULT_HISTORY_YEARS = 5;

/** Date de départ de l'historique d'une position : sa date d'achat, sinon 5 ans. */
export function historyStart(purchaseDate: string | null | undefined) {
  if (purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) return purchaseDate;
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - DEFAULT_HISTORY_YEARS);
  return isoDate(d);
}

export type SyncReport = { updated: number; errors: { name: string; ticker: string; message: string }[] };

/**
 * Met à jour les cours de toutes les positions cotées (avec ticker) d'un utilisateur,
 * ou de tous les utilisateurs si userId est absent (tâche quotidienne).
 * Le cours actuel est converti dans la devise de la position.
 */
export async function syncInvestmentPrices(userId?: string, onlyId?: string): Promise<SyncReport> {
  const investments = await db.investment.findMany({
    where: { ticker: { not: null }, ...(userId ? { userId } : {}), ...(onlyId ? { id: onlyId } : {}) },
  });

  const report: SyncReport = { updated: 0, errors: [] };
  const done = new Map<string, Awaited<ReturnType<typeof syncSymbol>>>();

  for (const inv of investments) {
    const ticker = inv.ticker!.trim();
    if (!ticker) continue;
    try {
      const from = historyStart(inv.purchaseDate);
      const quote = done.get(ticker + from) ?? (await syncSymbol(ticker, from));
      done.set(ticker + from, quote);
      if (!quote) throw new Error("Aucun cours reçu");

      let price = quote.close;
      const target = (inv.currency || "EUR").toUpperCase();
      if (quote.currency !== target) {
        // devise de cotation → EUR → devise de la position
        price = (price * (await latestFxToEur(quote.currency, from))) / (await latestFxToEur(target, from));
      }

      await db.investment.update({
        where: { id: inv.id },
        data: { currentPrice: Math.round(price * 10000) / 10000, priceUpdatedAt: new Date(quote.date + "T00:00:00Z") },
      });
      report.updated++;
    } catch (e) {
      report.errors.push({ name: inv.name, ticker, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return report;
}

/** Dernier taux connu en base pour convertir une devise en euros (sans appel réseau). */
export async function storedRateToEur(currency: string | null | undefined): Promise<number> {
  const c = (currency || "EUR").toUpperCase();
  if (c === "EUR") return 1;
  const row = await db.priceHistory.findFirst({ where: { symbol: fxSymbol(c) }, orderBy: { date: "desc" } });
  return row?.close ?? 1;
}
