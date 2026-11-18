import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatPercent(value: number): string {
  const formatted = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return `${value >= 0 ? "+" : ""}${formatted} %`;
}

/** Lit une réponse JSON de l'API et lève une erreur si le serveur a échoué. */
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Lecture d'un champ nombre facultatif dans un formulaire (react-hook-form, option setValueAs) :
 * vide, 0 ou invalide → undefined (champ non renseigné), sinon le nombre.
 */
export function optionalNumber(v: unknown): number | undefined {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
