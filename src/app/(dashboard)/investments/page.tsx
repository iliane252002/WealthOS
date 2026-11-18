"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createInvestmentSchema, type CreateInvestmentInput, assetTypes } from "@/lib/validators/investment";
import { TrendingUp, Plus, X, Search, Pencil, Trash2, Loader2, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { PortfolioChart, PositionChart, Sparkline, type PortfolioPoint, type PricePoint, type Trade } from "@/components/investments/charts";
import { TransactionsPanel } from "@/components/investments/transactions-panel";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface StockResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

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
  purchaseDate: string | null;
  priceUpdatedAt: string | null;
}

interface PositionHistory {
  id: string;
  ticker: string | null;
  currency: string;
  tracked: boolean;
  series: PricePoint[];
  rangeChangePct: number | null;
  realized: number;
  closed: boolean;
  trades: Trade[];
}

interface History {
  range: string;
  lastUpdate: string | null;
  points: (PortfolioPoint & { netFlow: number })[];
  positions: PositionHistory[];
  realized: number;
}

interface SyncReport {
  updated: number;
  errors: { name: string; ticker: string; message: string }[];
}

const RANGES = [
  { key: "1M", fr: "1 M", en: "1M" },
  { key: "6M", fr: "6 M", en: "6M" },
  { key: "1Y", fr: "1 an", en: "1Y" },
  { key: "5Y", fr: "5 ans", en: "5Y" },
  { key: "MAX", fr: "Max", en: "Max" },
];

const money = (value: number, currency = "EUR") => formatCurrency(value, currency || "EUR");

const toFormValues = (inv: Investment): CreateInvestmentInput => ({
  name: inv.name,
  assetType: inv.assetType as CreateInvestmentInput["assetType"],
  ticker: inv.ticker ?? "",
  quantity: inv.quantity ?? undefined,
  buyPrice: inv.buyPrice,
  currentPrice: inv.currentPrice ?? undefined,
  currency: inv.currency,
  broker: inv.broker ?? "",
  accountName: inv.accountName ?? "",
  purchaseDate: inv.purchaseDate ?? "",
});

export default function InvestmentsPage() {
  const queryClient = useQueryClient();
  const { t, locale } = useI18n();

  const [range, setRange] = useState("1Y");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);

  const { data: history, isFetching: historyLoading } = useQuery<History>({
    queryKey: ["investments-history", range],
    queryFn: () => fetch(`/api/investments/history?range=${range}`).then((r) => r.json()),
    placeholderData: (prev) => prev,
  });

  const syncMutation = useMutation({
    mutationFn: async (): Promise<SyncReport> => {
      const res = await fetch("/api/investments/sync", { method: "POST" });
      if (!res.ok) throw new Error("sync failed");
      return res.json();
    },
    onSuccess: (report) => {
      setSyncReport(report);
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["investments-history"] });
    },
  });

  const [mode, setMode] = useState<"none" | "create" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: investments, isLoading } = useQuery<Investment[]>({
    queryKey: ["investments"],
    queryFn: () => fetch("/api/investments").then((r) => r.json()),
  });

  const [stockSearch, setStockSearch] = useState("");
  const [showStockResults, setShowStockResults] = useState(false);
  const stockDropdownRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(stockSearch, 300);

  const form = useForm<CreateInvestmentInput>({
    resolver: zodResolver(createInvestmentSchema),
    defaultValues: { currency: "EUR" },
  });

  const { data: stockResults = [] } = useQuery<StockResult[]>({
    queryKey: ["stock-search", debouncedSearch],
    queryFn: () =>
      fetch(`/api/stocks/search?q=${encodeURIComponent(debouncedSearch)}`).then((r) => r.json()),
    enabled: debouncedSearch.length >= 2,
  });

  const selectStock = useCallback(
    (stock: StockResult) => {
      form.setValue("name", stock.name);
      form.setValue("ticker", stock.symbol);
      const typeMap: Record<string, string> = {
        EQUITY: "STOCK",
        ETF: "ETF",
        MUTUALFUND: "FUND",
        CRYPTOCURRENCY: "CRYPTO",
      };
      form.setValue(
        "assetType",
        (typeMap[stock.type] || "OTHER") as CreateInvestmentInput["assetType"]
      );
      setStockSearch("");
      setShowStockResults(false);
    },
    [form]
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        stockDropdownRef.current &&
        !stockDropdownRef.current.contains(e.target as Node)
      ) {
        setShowStockResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (mode === "edit" && editingId) {
      const item = (investments || []).find((inv) => inv.id === editingId);
      if (item) form.reset(toFormValues(item));
    } else if (mode === "create") {
      form.reset({ currency: "EUR" });
      setStockSearch("");
    }
  }, [mode, editingId, investments, form]);

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
      queryClient.invalidateQueries({ queryKey: ["investments-history"] });
      setMode("none");
      form.reset({ currency: "EUR" });
      setStockSearch("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateInvestmentInput }) => {
      const res = await fetch(`/api/investments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update investment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["investments-history"] });
      setMode("none");
      setEditingId(null);
      form.reset({ currency: "EUR" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/investments/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["investments-history"] });
    },
  });

  const onSubmit = (data: CreateInvestmentInput) => {
    if (mode === "edit" && editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    setMode("none");
    setEditingId(null);
    form.reset({ currency: "EUR" });
    setStockSearch("");
  };

  const portfolio = (investments || []).reduce(
    (acc, inv) => {
      const qty = inv.quantity ?? 1;
      const currentVal = (inv.currentPrice || inv.buyPrice) * qty;
      const buyVal = inv.buyPrice * qty;
      acc.totalValue += currentVal;
      acc.totalCost += buyVal;
      return acc;
    },
    { totalValue: 0, totalCost: 0 }
  );
  // Les totaux viennent de la courbe (convertis en euros) quand elle existe
  const lastPoint = history?.points[history.points.length - 1];
  const firstPoint = history?.points[0];
  const totalValue = lastPoint?.value ?? portfolio.totalValue;
  const totalCost = lastPoint?.invested ?? portfolio.totalCost;
  const totalGainLoss = totalValue - totalCost;
  const totalPerformance = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  // Gain de marché sur la période : variation de valeur moins les nouveaux achats
  const period =
    firstPoint && lastPoint && history!.points.length > 1
      ? (() => {
          const added = lastPoint.netFlow - firstPoint.netFlow;
          const gain = lastPoint.value - firstPoint.value - added;
          const base = firstPoint.value + added;
          return { gain, pct: base > 0 ? (gain / base) * 100 : 0 };
        })()
      : null;

  const historyById = new Map((history?.positions ?? []).map((p) => [p.id, p]));
  const realizedTotal = history?.realized ?? 0;
  // En modification : quantité, prix et date sont calculés dès qu'il y a plusieurs opérations
  const lockedByOps = mode === "edit" && !!editingId && (historyById.get(editingId)?.trades.length ?? 0) > 1;

  const assetTypeKeys: Record<string, TranslationKey> = {
    STOCK: "investments.stock",
    ETF: "investments.etf",
    BOND: "investments.bond",
    CRYPTO: "investments.crypto",
    FUND: "investments.fund",
    SAVINGS_ACCOUNT: "investments.savings",
    LIFE_INSURANCE: "investments.lifeInsurance",
    OTHER: "investments.other",
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-slate-900">{t("investments.title")}</h1>
        <button
          onClick={() => {
            if (mode !== "none") {
              handleCancel();
            } else {
              setMode("create");
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 text-sm font-medium transition-colors"
        >
          {mode !== "none" ? <X size={16} /> : <Plus size={16} />}
          {mode !== "none" ? t("investments.cancel") : t("investments.addPosition")}
        </button>
      </div>

      {/* Évolution du portefeuille */}
      <section className="bg-white border border-slate-200 rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-slate-200 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t("investments.totalValue")}</p>
            <p className="mt-2 text-[26px] leading-none font-semibold tabular-nums text-slate-900">{money(totalValue)}</p>
            <p className="mt-2 text-[13px] text-slate-500 tabular-nums">
              {t("investments.invested")} : {money(totalCost)}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t("investments.unrealized")}</p>
            <p className={`mt-2 text-[26px] leading-none font-semibold tabular-nums ${totalGainLoss >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {totalGainLoss >= 0 ? "+" : ""}
              {money(totalGainLoss)}
            </p>
            <p className="mt-2 text-[13px] tabular-nums text-slate-500">
              <span className={totalPerformance >= 0 ? "text-emerald-600" : "text-red-600"}>{formatPercent(totalPerformance)}</span>
              {realizedTotal !== 0 && (
                <span>
                  {" "}· {t("investments.realized")} :{" "}
                  <span className={realizedTotal >= 0 ? "text-emerald-600" : "text-red-600"}>
                    {realizedTotal >= 0 ? "+" : ""}
                    {money(realizedTotal)}
                  </span>
                </span>
              )}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
              {t("investments.performance")} {t("investments.periodChange")}
            </p>
            {period ? (
              <>
                <p className={`mt-2 text-[26px] leading-none font-semibold tabular-nums ${period.gain >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {period.gain >= 0 ? "+" : ""}
                  {money(period.gain)}
                </p>
                <p className="mt-2 text-[13px] text-slate-500 tabular-nums">
                  <span className={period.pct >= 0 ? "text-emerald-600" : "text-red-600"}>{formatPercent(period.pct)}</span>
                  <span> · {t("investments.periodChangeHint")}</span>
                </p>
              </>
            ) : (
              <p className="mt-2 text-[26px] leading-none font-semibold text-slate-300">—</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
          <h2 className="text-[13px] font-semibold text-slate-900">{t("investments.evolution")}</h2>
          <div className="flex items-center gap-3">
            {historyLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-md" role="tablist">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  role="tab"
                  aria-selected={range === r.key}
                  onClick={() => setRange(r.key)}
                  className={`h-7 px-2.5 rounded-[4px] text-[12px] font-medium transition-colors ${
                    range === r.key ? "bg-white text-slate-900 border border-slate-200" : "text-slate-500 hover:text-slate-900 border border-transparent"
                  }`}
                >
                  {locale === "fr" ? r.fr : r.en}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-3 pt-2 pb-1">
          {history && history.points.length > 1 ? (
            <PortfolioChart
              points={history.points}
              locale={locale}
              labels={{ value: t("investments.value"), invested: t("investments.invested") }}
            />
          ) : (
            <p className="px-2 py-16 text-center text-[13px] text-slate-500">{t("investments.noHistory")}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 text-[12px] text-slate-500">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-600" /> {t("investments.value")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 border-t border-dashed border-slate-400" /> {t("investments.invested")}
            </span>
            {history?.lastUpdate && (
              <span className="tabular-nums">
                {t("investments.pricesAsOf")} {new Date(history.lastUpdate + "T00:00:00").toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB")} · {t("investments.source")}
              </span>
            )}
          </div>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={13} className={syncMutation.isPending ? "animate-spin" : ""} />
            {syncMutation.isPending ? t("investments.updating") : t("investments.updatePrices")}
          </button>
        </div>
        {syncReport && syncReport.errors.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-200 bg-red-50 text-[12px] text-red-700">
            {t("investments.priceErrors")}{" "}
            {syncReport.errors.map((e) => `${e.name} (${e.ticker})`).join(", ")}
          </div>
        )}
      </section>

      {/* Create mode: full form with stock search */}
      {mode === "create" && (
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4"
        >
          {/* Stock Search */}
          <div ref={stockDropdownRef} className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <Search size={14} className="inline mr-1" />
              {t("investments.searchStock")}
            </label>
            <input
              value={stockSearch}
              onChange={(e) => {
                setStockSearch(e.target.value);
                setShowStockResults(true);
              }}
              onFocus={() => {
                if (stockSearch.length >= 2) setShowStockResults(true);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("investments.searchPlaceholder")}
            />
            {showStockResults && stockResults.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {stockResults.map((stock) => (
                  <button
                    key={stock.symbol}
                    type="button"
                    onClick={() => selectStock(stock)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-center justify-between border-b border-slate-50 last:border-0 transition-colors"
                  >
                    <div>
                      <span className="font-medium text-slate-900 text-sm">{stock.name}</span>
                      <span className="text-xs text-slate-400 ml-2">{stock.exchange}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                        {stock.symbol}
                      </span>
                      <span className="text-xs text-slate-400">{stock.type}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.name")}
              </label>
              <input
                {...form.register("name")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. LVMH"
              />
              {form.formState.errors.name && (
                <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.assetType")}
              </label>
              <select
                {...form.register("assetType")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t("investments.selectType")}</option>
                {assetTypes.map((at) => (
                  <option key={at} value={at}>{t(assetTypeKeys[at])}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.quantity")}
              </label>
              <input
                {...form.register("quantity", { valueAsNumber: true })}
                type="number"
                step="0.000001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.buyPrice")}
              </label>
              <input
                {...form.register("buyPrice", { valueAsNumber: true })}
                type="number"
                step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {form.formState.errors.buyPrice && (
                <p className="text-red-500 text-xs mt-1">{form.formState.errors.buyPrice.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.currentPrice")}
              </label>
              <input
                {...form.register("currentPrice", { valueAsNumber: true })}
                type="number"
                step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.ticker")}
              </label>
              <input
                {...form.register("ticker")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="MC.PA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.purchaseDate")}
              </label>
              <input
                type="date"
                {...form.register("purchaseDate")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.broker")}
              </label>
              <input
                {...form.register("broker")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.account")}
              </label>
              <input
                {...form.register("accountName")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t("investments.accountPlaceholder")}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              {t("investments.cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  {t("investments.adding")}
                </span>
              ) : (
                t("investments.addPosition")
              )}
            </button>
          </div>
        </form>
      )}

      {/* Edit mode: simplified form without stock search */}
      {mode === "edit" && (
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="bg-white rounded-xl border border-blue-300 shadow-sm p-6 space-y-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Pencil size={14} className="text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">Modifier la position</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.name")}
              </label>
              <input
                {...form.register("name")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {form.formState.errors.name && (
                <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.assetType")}
              </label>
              <select
                {...form.register("assetType")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {assetTypes.map((at) => (
                  <option key={at} value={at}>{t(assetTypeKeys[at])}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.quantity")}
              </label>
              <input
                {...form.register("quantity", { valueAsNumber: true })}
                readOnly={lockedByOps}
                title={lockedByOps ? t("investments.managedByOperations") : undefined}
                type="number"
                step="0.000001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.buyPrice")}
              </label>
              <input
                {...form.register("buyPrice", { valueAsNumber: true })}
                readOnly={lockedByOps}
                title={lockedByOps ? t("investments.managedByOperations") : undefined}
                type="number"
                step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {form.formState.errors.buyPrice && (
                <p className="text-red-500 text-xs mt-1">{form.formState.errors.buyPrice.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.currentPrice")}
              </label>
              <input
                {...form.register("currentPrice", { valueAsNumber: true })}
                type="number"
                step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {lockedByOps && (
            <p className="text-xs text-slate-500 -mt-2">{t("investments.managedByOperations")}</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.ticker")}
              </label>
              <input
                {...form.register("ticker")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="MC.PA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.purchaseDate")}
              </label>
              <input
                type="date"
                {...form.register("purchaseDate")}
                readOnly={lockedByOps}
                title={lockedByOps ? t("investments.managedByOperations") : undefined}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.broker")}
              </label>
              <input
                {...form.register("broker")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("investments.account")}
              </label>
              <input
                {...form.register("accountName")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t("investments.accountPlaceholder")}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              {t("investments.cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  {t("propertyEdit.saving")}
                </span>
              ) : (
                t("propertyEdit.save")
              )}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
          <div className="h-32 bg-slate-200 rounded" />
        </div>
      ) : !investments || investments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <TrendingUp size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {t("investments.noInvestments")}
          </h3>
          <p className="text-slate-500">{t("investments.noInvestmentsDesc")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-slate-500">
                  {t("investments.asset")}
                </th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">
                  {t("investments.type")}
                </th>
                <th className="text-right px-6 py-3 font-medium text-slate-500">
                  {t("investments.qty")}
                </th>
                <th className="text-right px-6 py-3 font-medium text-slate-500">
                  {t("investments.pru")}
                </th>
                <th className="text-right px-6 py-3 font-medium text-slate-500">
                  {t("investments.price")}
                </th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">
                  {t("investments.trend")} · {RANGES.find((r) => r.key === range)?.[locale === "fr" ? "fr" : "en"]}
                </th>
                <th className="text-right px-6 py-3 font-medium text-slate-500">
                  {t("investments.gainLoss")}
                </th>
                <th className="text-center px-6 py-3 font-medium text-slate-500">
                  {t("investments.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {investments.map((inv) => {
                const qty = inv.quantity ?? 1;
                const current = (inv.currentPrice || inv.buyPrice) * qty;
                const cost = inv.buyPrice * qty;
                const gainLoss = current - cost;
                const perf = cost > 0 ? (gainLoss / cost) * 100 : 0;
                const h = historyById.get(inv.id);
                const tracked = !!h?.tracked && h.series.length > 1;
                const expanded = expandedId === inv.id;
                const closed = h?.closed ?? qty === 0;
                const change = h?.rangeChangePct ?? null;
                return (
                  <Fragment key={inv.id}>
                  <tr
                    onClick={() => setExpandedId(expanded ? null : inv.id)}
                    className={`border-b border-slate-100 transition-colors cursor-pointer hover:bg-slate-50 ${closed ? "text-slate-400" : ""} ${
                      editingId === inv.id || expanded ? "bg-slate-50" : ""
                    }`}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 w-3.5 text-slate-400">
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <div>
                          <span className={`font-medium ${closed ? "text-slate-500" : "text-slate-900"}`}>{inv.name}</span>
                          {closed && (
                            <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{t("investments.closed")}</span>
                          )}
                          {inv.ticker && (
                            <span className="text-slate-400 ml-1.5 text-xs font-mono">{inv.ticker}</span>
                          )}
                          {inv.broker && (
                            <p className="text-xs text-slate-400 mt-0.5">{inv.broker}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {t(assetTypeKeys[inv.assetType]) || inv.assetType}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-slate-600 tabular-nums">{qty}</td>
                    <td className="px-6 py-3 text-right text-slate-600 tabular-nums">
                      {money(inv.buyPrice, inv.currency)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      <span className="font-medium text-slate-900">{money(inv.currentPrice || inv.buyPrice, inv.currency)}</span>
                      {!inv.ticker && <p className="text-[11px] text-slate-400">{t("investments.manualPrice")}</p>}
                    </td>
                    <td className="px-6 py-3">
                      {tracked ? (
                        <div className="flex items-center gap-2">
                          <Sparkline points={h!.series} up={(change ?? 0) >= 0} />
                          {change != null && (
                            <span className={`text-xs tabular-nums ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {formatPercent(change)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {closed ? (
                        <>
                          <span className={`font-medium ${(h?.realized ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {(h?.realized ?? 0) >= 0 ? "+" : ""}
                            {money(h?.realized ?? 0, inv.currency)}
                          </span>
                          <p className="text-xs text-slate-500">{t("investments.realized")}</p>
                        </>
                      ) : (
                        <>
                          <span className={`font-medium ${gainLoss >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {gainLoss >= 0 ? "+" : ""}
                            {money(gainLoss, inv.currency)}
                          </span>
                          <p className={`text-xs ${gainLoss >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatPercent(perf)}</p>
                        </>
                      )}
                    </td>
                    <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setEditingId(inv.id);
                            setMode("edit");
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(inv.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <td colSpan={8} className="px-6 pb-5 pt-1 space-y-3 whitespace-normal">
                        {tracked && (
                          <div className="bg-white border border-slate-200 rounded-md px-2 pt-3">
                            <PositionChart
                              points={h!.series}
                              buyPrice={inv.buyPrice}
                              currency={inv.currency}
                              locale={locale}
                              buyLabel={t("investments.pru")}
                              trades={h!.trades}
                              tradeLabels={{ buy: t("investments.buy"), sell: t("investments.sell") }}
                            />
                          </div>
                        )}
                        <div>
                          <h3 className="text-[13px] font-semibold text-slate-900 mb-2">{t("investments.operations")}</h3>
                          <TransactionsPanel investmentId={inv.id} currency={inv.currency} currentPrice={inv.currentPrice} />
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
