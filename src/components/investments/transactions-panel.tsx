"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, fetchJson } from "@/lib/utils";
import { isoToday } from "@/components/investments/dates";

interface TxRow {
  id: string;
  type: "BUY" | "SELL";
  date: string;
  quantity: number;
  price: number;
  fees: number;
  heldAfter: number;
  pruAfter: number;
  realized: number | null;
}

interface PositionState {
  quantity: number;
  pru: number;
  costBasis: number;
  realized: number;
  transactions: TxRow[];
}

const inputCls =
  "w-full h-8 px-2.5 border border-slate-300 rounded-md text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums";

export function TransactionsPanel({
  investmentId,
  currency,
  currentPrice,
}: {
  investmentId: string;
  currency: string;
  currentPrice: number | null;
}) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const key = ["investment-transactions", investmentId];

  const { data, isLoading, isError } = useQuery<PositionState>({
    queryKey: key,
    queryFn: () => fetchJson<PositionState>(`/api/investments/${investmentId}/transactions`),
    retry: 1,
  });

  const [form, setForm] = useState({ type: "BUY", date: isoToday(), quantity: "", price: "", fees: "" });
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ["investments"] });
    queryClient.invalidateQueries({ queryKey: ["investments-history"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const readError = async (res: Response) => {
    const body = await res.json().catch(() => ({}));
    if (typeof body.error === "string") return body.error;
    const fields = body.error?.fieldErrors as Record<string, string[]> | undefined;
    return fields ? Object.values(fields).flat().join(" · ") : "Erreur";
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/investments/${investmentId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          date: form.date,
          quantity: Number(form.quantity.replace(",", ".")),
          price: Number(form.price.replace(",", ".")),
          fees: form.fees ? Number(form.fees.replace(",", ".")) : 0,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: () => {
      setError(null);
      setForm((f) => ({ ...f, quantity: "", price: "", fees: "" }));
      refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (txId: string) => {
      const res = await fetch(`/api/investments/${investmentId}/transactions/${txId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: () => {
      setError(null);
      setConfirmId(null);
      refresh();
    },
    onError: (e: Error) => {
      setConfirmId(null);
      setError(e.message);
    },
  });

  const money = (v: number) => formatCurrency(v, currency);
  const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB");
  const fmtQty = (q: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 8 }).format(q);

  if (isError) {
    return <p className="text-[13px] text-red-600">{t("investments.loadError")}</p>;
  }

  if (isLoading || !data) {
    return (
      <div className="py-6 grid place-items-center">
        <Loader2 size={16} className="animate-spin text-slate-400" />
      </div>
    );
  }

  const unrealized = currentPrice != null ? data.quantity * currentPrice - data.costBasis : null;
  const rows = [...data.transactions].reverse(); // plus récentes en premier

  return (
    <div className="space-y-3">
      {/* Synthèse de la position */}
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-md overflow-hidden text-[13px]">
        <div className="bg-white px-3 py-2">
          <dt className="text-[11px] uppercase tracking-[0.06em] text-slate-500">{t("investments.held")}</dt>
          <dd className="mt-0.5 font-medium text-slate-900 tabular-nums">{fmtQty(data.quantity)}</dd>
        </div>
        <div className="bg-white px-3 py-2" title={t("investments.pruHint")}>
          <dt className="text-[11px] uppercase tracking-[0.06em] text-slate-500">{t("investments.pru")}</dt>
          <dd className="mt-0.5 font-medium text-slate-900 tabular-nums">{money(data.pru)}</dd>
        </div>
        <div className="bg-white px-3 py-2">
          <dt className="text-[11px] uppercase tracking-[0.06em] text-slate-500">{t("investments.unrealized")}</dt>
          <dd
            className={`mt-0.5 font-medium tabular-nums ${
              unrealized == null ? "text-slate-400" : unrealized >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {unrealized == null ? "—" : `${unrealized >= 0 ? "+" : ""}${money(unrealized)}`}
          </dd>
        </div>
        <div className="bg-white px-3 py-2">
          <dt className="text-[11px] uppercase tracking-[0.06em] text-slate-500">{t("investments.realizedGain")}</dt>
          <dd className={`mt-0.5 font-medium tabular-nums ${data.realized >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {data.realized >= 0 ? "+" : ""}
            {money(data.realized)}
          </dd>
        </div>
      </dl>

      {/* Liste des opérations */}
      <div className="border border-slate-200 rounded-md overflow-x-auto bg-white">
        <table className="w-full text-[13px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.06em] text-slate-500 border-b border-slate-200">
              <th className="text-left font-medium px-3 py-2">{t("investments.date")}</th>
              <th className="text-left font-medium px-3 py-2">{t("investments.type")}</th>
              <th className="text-right font-medium px-3 py-2">{t("investments.quantity")}</th>
              <th className="text-right font-medium px-3 py-2">{t("investments.unitPrice")}</th>
              <th className="text-right font-medium px-3 py-2">{t("investments.fees")}</th>
              <th className="text-right font-medium px-3 py-2">{t("investments.amount")}</th>
              <th className="text-right font-medium px-3 py-2">{t("investments.realizedGain")}</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => {
              const amount = tx.quantity * tx.price + (tx.type === "BUY" ? tx.fees : -tx.fees);
              return (
                <tr key={tx.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 tabular-nums text-slate-700">{fmtDate(tx.date)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                        tx.type === "BUY" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {tx.type === "BUY" ? t("investments.buy") : t("investments.sell")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {tx.type === "SELL" ? "−" : ""}
                    {fmtQty(tx.quantity)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{money(tx.price)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{tx.fees ? money(tx.fees) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">{money(amount)}</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      tx.realized == null ? "text-slate-300" : tx.realized >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {tx.realized == null ? "—" : `${tx.realized >= 0 ? "+" : ""}${money(tx.realized)}`}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {confirmId === tx.id ? (
                      <button
                        onClick={() => deleteMutation.mutate(tx.id)}
                        disabled={deleteMutation.isPending}
                        className="h-6 px-2 rounded text-[12px] font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {t("investments.confirmDelete")}
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmId(tx.id)}
                        aria-label={t("investments.deleteOperation")}
                        title={t("investments.deleteOperation")}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Ajout d'une opération */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addMutation.mutate();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="w-28">
          <label htmlFor={`tx-type-${investmentId}`} className="block text-[11px] text-slate-500 mb-1">
            {t("investments.type")}
          </label>
          <select
            id={`tx-type-${investmentId}`}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className={inputCls}
          >
            <option value="BUY">{t("investments.buy")}</option>
            <option value="SELL">{t("investments.sell")}</option>
          </select>
        </div>
        <div className="w-36">
          <label htmlFor={`tx-date-${investmentId}`} className="block text-[11px] text-slate-500 mb-1">
            {t("investments.date")}
          </label>
          <input
            id={`tx-date-${investmentId}`}
            type="date"
            required
            value={form.date}
            max={isoToday()}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="w-28">
          <label htmlFor={`tx-qty-${investmentId}`} className="block text-[11px] text-slate-500 mb-1">
            {t("investments.quantity")}
          </label>
          <input
            id={`tx-qty-${investmentId}`}
            inputMode="decimal"
            required
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className={inputCls}
            placeholder="10"
          />
        </div>
        <div className="w-32">
          <label htmlFor={`tx-price-${investmentId}`} className="block text-[11px] text-slate-500 mb-1">
            {t("investments.unitPrice")} ({currency})
          </label>
          <input
            id={`tx-price-${investmentId}`}
            inputMode="decimal"
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className={inputCls}
            placeholder={currentPrice ? String(Math.round(currentPrice * 100) / 100) : ""}
          />
        </div>
        <div className="w-24">
          <label htmlFor={`tx-fees-${investmentId}`} className="block text-[11px] text-slate-500 mb-1">
            {t("investments.fees")}
          </label>
          <input
            id={`tx-fees-${investmentId}`}
            inputMode="decimal"
            value={form.fees}
            onChange={(e) => setForm({ ...form, fees: e.target.value })}
            className={inputCls}
            placeholder="0"
          />
        </div>
        <button
          type="submit"
          disabled={addMutation.isPending}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-blue-700 text-white text-[13px] font-medium hover:bg-blue-800 disabled:opacity-60"
        >
          {addMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          {t("investments.addOperation")}
        </button>
      </form>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
