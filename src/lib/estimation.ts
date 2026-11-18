import { db } from "@/lib/db";

/**
 * Estimation de la valeur d'un bien à partir des ventes réelles (DVF, data.gouv.fr).
 *
 * 1. L'adresse est géolocalisée avec la Base Adresse Nationale (api-adresse.data.gouv.fr).
 * 2. On charge les ventes des deux dernières années publiées dans la commune
 *    (ou l'arrondissement à Paris, Lyon, Marseille).
 * 3. Appartement / maison : ventes simples d'un seul logement du même type,
 *    prix médian au m² autour de l'adresse (500 m, puis 1 km), sinon sur la commune.
 *    Immeuble : ventes en bloc de plusieurs logements sur 4 ans (1 km, 2 km, commune) ;
 *    s'il y en a trop peu, prix des appartements avec une décote de 20 %.
 * 4. Valeur estimée = prix médian au m² × surface du bien.
 *
 * DVF ne couvre pas l'Alsace, la Moselle ni Mayotte.
 */

const BAN_URL = "https://api-adresse.data.gouv.fr/search/";
const DVF_BASE = "https://files.data.gouv.fr/geo-dvf/latest/csv/";
const MIN_SALES = 12;
const RADII_M = [500, 1000];

export type EstimateDetails = {
  commune: string;
  codeCommune: string;
  localType: "Appartement" | "Maison" | "Appartement ou maison" | "Immeuble";
  /** Décote appliquée (en %) quand un immeuble est estimé faute de ventes en bloc */
  discount?: number;
  sales: number;
  radius: number | null; // null = toute la commune
  period: string; // ex. "2024–2025"
  surface: number;
};

export type EstimateResult =
  | { ok: true; value: number; pricePerM2: number; details: EstimateDetails }
  | { ok: false; reason: string };

type Sale = { date: string; price: number; surface: number; type: string; lon: number; lat: number };
/** Vente en bloc de plusieurs logements (un immeuble ou une partie d'immeuble) */
type BlockSale = { date: string; price: number; surface: number; homes: number; lon: number; lat: number };

const BUILDING_RADII_M = [1000, 2000];
const MIN_BUILDING_SALES = 5;
const BUILDING_FALLBACK_DISCOUNT = 20; // %

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Requête réseau avec un nouvel essai en cas d'échec passager. */
async function fetchRetry(url: string, init: RequestInit & { timeoutMs: number }) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs) });
      if (res.status >= 500 && attempt === 0) continue;
      return res;
    } catch (e) {
      if (attempt >= 1) throw e;
    }
  }
}

class ServiceUnavailable extends Error {}

async function geocode(address: string, postalCode?: string | null, city?: string | null) {
  const q = [address, postalCode, city].filter(Boolean).join(" ");
  let res: Response;
  try {
    res = await fetchRetry(`${BAN_URL}?q=${encodeURIComponent(q)}&limit=1`, { timeoutMs: 10000, cache: "no-store" });
  } catch {
    throw new ServiceUnavailable();
  }
  if (!res.ok) throw new ServiceUnavailable();
  const json = await res.json();
  const f = json?.features?.[0];
  if (!f || (f.properties?.score ?? 0) < 0.4) return null;
  const [lon, lat] = f.geometry.coordinates as [number, number];
  return {
    lon,
    lat,
    citycode: String(f.properties.citycode),
    city: String(f.properties.district || f.properties.city),
    precise: ["housenumber", "street"].includes(f.properties.type),
  };
}

/** Années disponibles dans DVF (les `count` plus récentes). */
async function latestYears(count = 2): Promise<string[]> {
  const res = await fetch(DVF_BASE, { signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } });
  if (!res.ok) return [];
  const html = await res.text();
  const years = [...html.matchAll(/csv\/(\d{4})\//g)].map((m) => m[1]);
  return [...new Set(years)].sort().slice(-count);
}

async function loadSales(citycode: string, years: string[]): Promise<{ sales: Sale[]; blocks: BlockSale[] }> {
  const dep = citycode.startsWith("97") ? citycode.slice(0, 3) : citycode.slice(0, 2);
  // Ventes regroupées par mutation : on ne garde que celles d'un seul logement
  const mutations = new Map<string, { price: number; homes: Sale[]; isSale: boolean }>();

  for (const year of years) {
    const res = await fetchRetry(`${DVF_BASE}${year}/communes/${dep}/${citycode}.csv`, {
      timeoutMs: 25000,
      cache: "no-store", // fichiers trop gros pour le cache de Next
    });
    if (!res.ok) continue;
    const lines = (await res.text()).split("\n");
    const header = parseCsvLine(lines[0]);
    const col = (name: string) => header.indexOf(name);
    const iId = col("id_mutation"),
      iDate = col("date_mutation"),
      iNature = col("nature_mutation"),
      iValue = col("valeur_fonciere"),
      iType = col("type_local"),
      iSurf = col("surface_reelle_bati"),
      iLon = col("longitude"),
      iLat = col("latitude");

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      const r = parseCsvLine(lines[i]);
      const id = r[iId];
      const m = mutations.get(id) ?? { price: Number(r[iValue]), homes: [], isSale: r[iNature] === "Vente" };
      const type = r[iType];
      if (type === "Appartement" || type === "Maison") {
        m.homes.push({
          date: r[iDate],
          price: Number(r[iValue]),
          surface: Number(r[iSurf]),
          type,
          lon: Number(r[iLon]),
          lat: Number(r[iLat]),
        });
      }
      mutations.set(id, m);
    }
  }

  const sales: Sale[] = [];
  const blocks: BlockSale[] = [];
  for (const m of mutations.values()) {
    if (!m.isSale || m.homes.length === 0 || !(m.price > 0)) continue;
    if (m.homes.length === 1) {
      const s = m.homes[0];
      if (!(s.surface >= 9)) continue;
      const ppm2 = s.price / s.surface;
      if (ppm2 < 300 || ppm2 > 40000) continue; // valeurs aberrantes
      sales.push(s);
    } else {
      // Plusieurs logements vendus ensemble : vente d'immeuble (ou d'une partie)
      if (m.homes.some((h) => !(h.surface > 0))) continue;
      const surface = m.homes.reduce((sum, h) => sum + h.surface, 0);
      if (surface < 60) continue;
      const ppm2 = m.price / surface;
      if (ppm2 < 200 || ppm2 > 25000) continue;
      const first = m.homes[0];
      blocks.push({ date: first.date, price: m.price, surface, homes: m.homes.length, lon: first.lon, lat: first.lat });
    }
  }
  return { sales, blocks };
}

export async function estimateValue(input: {
  address: string;
  postalCode?: string | null;
  city?: string | null;
  type?: string | null;
  surface?: number | null;
}): Promise<EstimateResult> {
  if (!input.surface || input.surface <= 0) {
    return { ok: false, reason: "Indiquez la surface du bien pour obtenir une estimation." };
  }
  let geo: Awaited<ReturnType<typeof geocode>>;
  try {
    geo = await geocode(input.address, input.postalCode, input.city);
  } catch {
    return { ok: false, reason: "Service d'adresses momentanément indisponible : réessayez dans un instant." };
  }
  if (!geo) return { ok: false, reason: "Adresse introuvable : vérifiez l'adresse, le code postal et la ville." };
  if (["57", "67", "68", "976"].some((d) => geo.citycode.startsWith(d))) {
    return { ok: false, reason: "Les ventes de l'Alsace, de la Moselle et de Mayotte ne sont pas publiées : estimation impossible." };
  }

  const isBuilding = input.type === "BUILDING";
  // Les ventes d'immeubles sont rares : on regarde 4 ans pour un immeuble, 2 ans sinon
  const allYears = await latestYears(isBuilding ? 4 : 2).catch(() => []);
  if (allYears.length === 0) return { ok: false, reason: "Données de ventes indisponibles pour le moment." };
  const recentYears = allYears.slice(-2);
  let data: Awaited<ReturnType<typeof loadSales>>;
  try {
    data = await loadSales(geo.citycode, allYears);
  } catch {
    return { ok: false, reason: "Données de ventes momentanément indisponibles : réessayez dans un instant." };
  }
  const period = (years: string[]) => (years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : years[0]);
  const near = <T extends { lat: number; lon: number }>(list: T[], radii: number[], min: number) => {
    if (geo.precise) {
      for (const r of radii) {
        const found = list.filter((s) => Number.isFinite(s.lat) && distanceM(geo.lat, geo.lon, s.lat, s.lon) <= r);
        if (found.length >= min) return { pool: found, radius: r as number | null };
      }
    }
    return { pool: list, radius: null as number | null };
  };
  const base = { commune: geo.city, codeCommune: geo.citycode, surface: input.surface };

  // Immeuble : prix au m² des ventes en bloc (plusieurs logements vendus ensemble)
  if (isBuilding) {
    const { pool, radius } = near(data.blocks, BUILDING_RADII_M, MIN_BUILDING_SALES);
    if (pool.length >= MIN_BUILDING_SALES) {
      const pricePerM2 = Math.round(median(pool.map((s) => s.price / s.surface)));
      return {
        ok: true,
        pricePerM2,
        value: Math.round((pricePerM2 * input.surface) / 1000) * 1000,
        details: { ...base, localType: "Immeuble", sales: pool.length, radius, period: period(allYears) },
      };
    }
  }

  // Appartement, maison (ou immeuble sans ventes en bloc comparables)
  const recent = data.sales.filter((s) => recentYears.some((y) => s.date.startsWith(y)));
  const wanted: string[] = input.type === "HOUSE" ? ["Maison"] : input.type ? ["Appartement"] : ["Appartement", "Maison"];
  const { pool, radius } = near(recent.filter((s) => wanted.includes(s.type)), RADII_M, MIN_SALES);
  if (pool.length < 5) {
    return { ok: false, reason: `Trop peu de ventes comparables à ${geo.city} pour estimer ce bien.` };
  }

  const median2 = median(pool.map((s) => s.price / s.surface));
  const discount = isBuilding ? BUILDING_FALLBACK_DISCOUNT : undefined;
  const pricePerM2 = Math.round(discount ? median2 * (1 - discount / 100) : median2);
  return {
    ok: true,
    pricePerM2,
    value: Math.round((pricePerM2 * input.surface) / 1000) * 1000,
    details: {
      ...base,
      localType: wanted.length === 2 ? "Appartement ou maison" : (wanted[0] as "Appartement" | "Maison"),
      sales: pool.length,
      radius,
      period: period(recentYears),
      ...(discount ? { discount } : {}),
    },
  };
}

/** Surface à utiliser : celle du bien, sinon la somme des surfaces de ses lots. */
async function effectiveSurface(propertyId: string, surface: number | null) {
  if (surface && surface > 0) return surface;
  const lots = await db.lot.findMany({ where: { propertyId }, select: { surface: true } });
  const total = lots.reduce((s, l) => s + (l.surface ?? 0), 0);
  return total > 0 ? total : null;
}

/** Calcule et enregistre l'estimation d'un bien. Renvoie le résultat (ou la raison de l'échec). */
export async function refreshPropertyEstimate(propertyId: string): Promise<EstimateResult> {
  const p = await db.property.findUnique({ where: { id: propertyId } });
  if (!p) return { ok: false, reason: "Bien introuvable" };
  const surface = await effectiveSurface(p.id, p.surface);
  const result = await estimateValue({ address: p.address, postalCode: p.postalCode, city: p.city, type: p.type, surface });
  await db.property.update({
    where: { id: p.id },
    data: result.ok
      ? {
          estimatedValue: result.value,
          estimatedPricePerM2: result.pricePerM2,
          estimateDetails: JSON.stringify(result.details),
          estimatedAt: new Date(),
        }
      : {
          estimatedValue: null,
          estimatedPricePerM2: null,
          estimateDetails: JSON.stringify({ error: result.reason }),
          estimatedAt: new Date(),
        },
  });
  return result;
}

/** Valeur retenue pour un bien : celle saisie, sinon l'estimation. */
export function effectiveValue(p: { currentValue: number | null; estimatedValue: number | null }) {
  return p.currentValue ?? p.estimatedValue ?? null;
}
