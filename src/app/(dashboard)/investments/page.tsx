"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createInvestmentSchema, type CreateInvestmentInput, assetTypes } from "@/lib/validators/investment";
import { TrendingUp, Plus, X, PieChart } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface Investment {
  id: string;
  name: string;
  assetType: string;
  ticker: string | null;
  quantity: number | null;
  buyPrice: number;
  currentPrice: number | null;
  currency: string;
  broker: string | null;
  accountName: string | null;
}

export default function InvestmentsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { t } = useI18n();

  const { data: investments, isLoading } = useQuery<Investment[]>({
    queryKey: ["investments"],
    queryFn: () => fetch("/api/investments").then((r) => r.json()),
  });

  const form = useForm<CreateInvestmentInput>({
    resolver: zodResolver(createInvestmentSchema),
    defaultValues: { currency: "EUR" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateInvestmentInput) => {
      const res = await fetch("/api/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create investment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      setShowForm(false);
      form.reset({ currency: "EUR" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/investments/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["investments"] }),
  });

  const portfolio = (investments || []).reduce(
    (acc, inv) => {
      const qty = inv.quantity || 1;
      const currentVal = (inv.currentPrice || inv.buyPrice) * qty;
      const buyVal = inv.buyPrice * qty;
      acc.totalValue += currentVal;
      acc.totalCost += buyVal;
      return acc;
    },
    { totalValue: 0, totalCost: 0 }
  );
  const totalGainLoss = portfolio.totalValue - portfolio.totalCost;
  const totalPerformance = portfolio.totalCost > 0 ? (totalGainLoss / portfolio.totalCost) * 100 : 0;

  const assetTypeKeys: Record<string, TranslationKey> = {
    STOCK: "investments.stock", ETF: "investments.etf", BOND: "investments.bond", CRYPTO: "investments.crypto",
    FUND: "investments.fund", SAVINGS_ACCOUNT: "investments.savings", LIFE_INSURANCE: "investments.lifeInsurance", OTHER: "investments.other",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("investments.title")}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? t("investments.cancel") : t("investments.addPosition")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <p className="text-sm text-slate-500">{t("investments.totalValue")}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(portfolio.totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <p className="text-sm text-slate-500">{t("investments.totalGainLoss")}</p>
          <p className={`text-2xl font-bold mt-1 ${totalGainLoss >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatCurrency(totalGainLoss)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <p className="text-sm text-slate-500">{t("investments.performance")}</p>
          <p className={`text-2xl font-bold mt-1 ${totalPerformance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatPercent(totalPerformance)}
          </p>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("investments.name")}</label>
              <input {...form.register("name")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. LVMH" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("investments.assetType")}</label>
              <select {...form.register("assetType")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">{t("investments.selectType")}</option>
                {assetTypes.map((at) => <option key={at} value={at}>{t(assetTypeKeys[at])}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("investments.quantity")}</label>
              <input {...form.register("quantity", { valueAsNumber: true })} type="number" step="0.000001" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("investments.buyPrice")}</label>
              <input {...form.register("buyPrice", { valueAsNumber: true })} type="number" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("investments.currentPrice")}</label>
              <input {...form.register("currentPrice", { valueAsNumber: true })} type="number" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("investments.ticker")}</label>
              <input {...form.register("ticker")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="MC.PA" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("investments.broker")}</label>
              <input {...form.register("broker")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("investments.account")}</label>
              <input {...form.register("accountName")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder={t("investments.accountPlaceholder")} />
            </div>
          </div>
          <button type="submit" disabled={createMutation.isPending} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">
            {createMutation.isPending ? t("investments.adding") : t("investments.addPosition")}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse"><div className="h-32 bg-slate-200 rounded" /></div>
      ) : !investments || investments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <TrendingUp size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{t("investments.noInvestments")}</h3>
          <p className="text-slate-500">{t("investments.noInvestmentsDesc")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-slate-500">{t("investments.asset")}</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">{t("investments.type")}</th>
                <th className="text-right px-6 py-3 font-medium text-slate-500">{t("investments.qty")}</th>
                <th className="text-right px-6 py-3 font-medium text-slate-500">{t("investments.buyPrice")}</th>
                <th className="text-right px-6 py-3 font-medium text-slate-500">{t("investments.current")}</th>
                <th className="text-right px-6 py-3 font-medium text-slate-500">{t("investments.gainLoss")}</th>
                <th className="text-right px-6 py-3 font-medium text-slate-500">{t("investments.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {investments.map((inv) => {
                const qty = inv.quantity || 1;
                const current = (inv.currentPrice || inv.buyPrice) * qty;
                const cost = inv.buyPrice * qty;
                const gainLoss = current - cost;
                const perf = cost > 0 ? (gainLoss / cost) * 100 : 0;
                return (
                  <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-900">{inv.name}</span>
                      {inv.ticker && <span className="text-slate-400 ml-1 text-xs">{inv.ticker}</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{t(assetTypeKeys[inv.assetType]) || inv.assetType}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">{qty}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(inv.buyPrice)}</td>
                    <td className="px-6 py-4 text-right font-medium">{formatCurrency(inv.currentPrice || inv.buyPrice)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-medium ${gainLoss >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {formatCurrency(gainLoss)} ({formatPercent(perf)})
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => deleteMutation.mutate(inv.id)} className="text-slate-400 hover:text-red-500">
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
