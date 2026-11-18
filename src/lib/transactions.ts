import { db } from "@/lib/db";

export type TxType = "BUY" | "SELL";

export interface Tx {
  id: string;
  type: string;
  date: string; // YYYY-MM-DD
  quantity: number;
  price: number;
  fees: number;
  createdAt?: Date | string;
}

export interface TxResult extends Tx {
  /** Quantité détenue après l'opération */
  heldAfter: number;
  /** Prix de revient unitaire après l'opération (frais d'achat inclus) */
  pruAfter: number;
  /** Plus-value réalisée (ventes uniquement) : quantité × (prix − PRU) − frais */
  realized: number | null;
}

export interface PositionState {
  quantity: number;
  pru: number;
  /** Coût d'acquisition de ce qui est encore détenu (quantité × PRU) */
  costBasis: number;
  realized: number;
  firstDate: string | null;
  transactions: TxResult[];
  /** Message d'erreur si une vente dépasse la quantité détenue */
  error: string | null;
}

const EPS = 1e-9;

export function sortTx<T extends Tx>(txs: T[]): T[] {
  return [...txs].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    // Le même jour : les achats avant les ventes, puis ordre de saisie
    if (a.type !== b.type) return a.type === "BUY" ? -1 : 1;
    return String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""));
  });
}

/**
 * Rejoue les opérations dans l'ordre chronologique.
 * Méthode du prix moyen pondéré (PRU), comme les courtiers français :
 * un achat recalcule le PRU, une vente ne le change pas.
 */
export function computePosition(txs: Tx[]): PositionState {
  let quantity = 0;
  let pru = 0;
  let realized = 0;
  let error: string | null = null;
  const out: TxResult[] = [];

  for (const tx of sortTx(txs)) {
    let txRealized: number | null = null;
    if (tx.type === "SELL") {
      if (tx.quantity > quantity + EPS && !error) {
        error = `Vente du ${tx.date} : ${tx.quantity} vendus pour ${round(quantity, 8)} détenus`;
      }
      txRealized = tx.quantity * (tx.price - pru) - (tx.fees || 0);
      realized += txRealized;
      quantity = Math.max(0, quantity - tx.quantity);
      if (quantity < EPS) quantity = 0;
    } else {
      const cost = quantity * pru + tx.quantity * tx.price + (tx.fees || 0);
      quantity += tx.quantity;
      pru = quantity > 0 ? cost / quantity : 0;
    }
    out.push({ ...tx, heldAfter: quantity, pruAfter: pru, realized: txRealized });
  }

  return {
    quantity,
    pru,
    costBasis: quantity * pru,
    realized,
    firstDate: out[0]?.date ?? null,
    transactions: out,
    error,
  };
}

/** Quantité détenue, coût d'acquisition et flux nets cumulés à une date (pour les courbes). */
export function stateAt(results: TxResult[], date: string) {
  let held = 0;
  let pru = 0;
  let netFlow = 0; // argent apporté − argent récupéré
  for (const tx of results) {
    if (tx.date > date) break;
    held = tx.heldAfter;
    pru = tx.pruAfter;
    netFlow += tx.type === "SELL" ? -(tx.quantity * tx.price - (tx.fees || 0)) : tx.quantity * tx.price + (tx.fees || 0);
  }
  return { held, costBasis: held * pru, netFlow };
}

function round(n: number, digits = 6) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * Recalcule la quantité, le PRU et la date du premier achat d'une position
 * à partir de ses opérations, et les enregistre sur la position.
 */
export async function recomputeInvestment(investmentId: string) {
  const txs = await db.investmentTransaction.findMany({ where: { investmentId } });
  if (txs.length === 0) return null;
  const state = computePosition(txs);
  await db.investment.update({
    where: { id: investmentId },
    data: {
      quantity: round(state.quantity, 8),
      // On garde le dernier PRU connu quand la position est soldée
      buyPrice: round(state.pru || state.transactions.at(-1)?.pruAfter || txs[0].price, 6),
      purchaseDate: state.firstDate,
    },
  });
  return state;
}
