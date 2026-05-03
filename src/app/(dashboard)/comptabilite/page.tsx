"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  TrendingUp,
  TrendingDown,
  BookOpen,
  Download,
  ChevronDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  MinusCircle,
} from "lucide-react";

interface AccountLine {
  account: string;
  label: string;
  amount: number;
}

interface LedgerEntry {
  account: string;
  label: string;
  description: string;
  date: string;
  amount: number;
  type: "debit" | "credit";
}

interface PaymentRow {
  tenantName: string;
  propertyName: string;
  lotLabel: string;
  expected: number;
  received: number;
  outstanding: number;
  events: Array<{ month: string; status: string; amount: number; paidAmount: number }>;
}

interface AccountingData {
  year: number;
  sciFilter: string;
  scis: string[];
  totalRevenue: number;
  totalExpenses: number;
  netResult: number;
  revenueLines: AccountLine[];
  expenseLines: AccountLine[];
  ledger: LedgerEntry[];
  paymentTracking: PaymentRow[];
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function StatusIcon({ status }: { status: string }) {
  if (status === "PAID") return <CheckCircle2 size={14} className="text-emerald-500" />;
  if (status === "LATE") return <AlertCircle size={14} className="text-red-500" />;
  if (status === "PARTIALLY_PAID") return <MinusCircle size={14} className="text-amber-500" />;
  return <Clock size={14} className="text-slate-300" />;
}

export default function ComptabilitePage() {
  const { t } = useI18n();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [sciFilter, setSciFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"result" | "ledger" | "payments">("result");

  const { data, isLoading } = useQuery<AccountingData>({
    queryKey: ["accounting", year, sciFilter],
    queryFn: () =>
      fetch(`/api/accounting?year=${year}&sci=${encodeURIComponent(sciFilter)}`).then((r) => r.json()),
  });

  // CSV export
  const exportCsv = () => {
    if (!data) return;
    const rows: string[] = ["Date,Compte,Libellé,Description,Débit,Crédit"];
    for (const entry of data.ledger) {
      rows.push(
        [
          entry.date,
          entry.account,
          entry.label,
          `"${entry.description.replace(/"/g, '""')}"`,
          entry.type === "debit" ? entry.amount.toFixed(2) : "",
          entry.type === "credit" ? entry.amount.toFixed(2) : "",
        ].join(",")
      );
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comptabilite_${year}_${sciFilter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const scis = data?.scis ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <BookOpen size={22} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("accounting.title")}</h1>
            <p className="text-sm text-slate-500">{t("accounting.subtitle")}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Year selector */}
          <div className="relative">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="appearance-none pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* SCI selector */}
          <div className="relative">
            <select
              value={sciFilter}
              onChange={(e) => setSciFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t("accounting.allScis")}</option>
              <option value="personal">{t("accounting.personalProperties")}</option>
              {scis.map((sci) => (
                <option key={sci} value={sci}>{sci}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* CSV Export */}
          <button
            onClick={exportCsv}
            disabled={!data || data.ledger.length === 0}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            <Download size={14} />
            {t("accounting.exportCsv")}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Revenue */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-emerald-600" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("accounting.revenues")}</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700">{fmt(data?.totalRevenue ?? 0)}</p>
            <p className="text-xs text-slate-400 mt-1">PCG 706x</p>
          </div>

          {/* Total Expenses */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={16} className="text-red-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("accounting.expenses")}</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{fmt(data?.totalExpenses ?? 0)}</p>
            <p className="text-xs text-slate-400 mt-1">PCG 6xxx</p>
          </div>

          {/* Net result */}
          <div className={`rounded-xl border shadow-sm p-5 ${(data?.netResult ?? 0) >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">{t("accounting.netResult")}</span>
            </div>
            <p className={`text-2xl font-bold ${(data?.netResult ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {fmt(data?.netResult ?? 0)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {(data?.netResult ?? 0) >= 0 ? t("accounting.profit") : t("accounting.loss")}
            </p>
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(["result", "payments", "ledger"] as const).map((tab) => {
          const labels = {
            result: t("accounting.incomeStatement"),
            payments: t("accounting.paymentTracking"),
            ledger: t("accounting.ledger"),
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* ── Income Statement ─────────────────────────────────────────────── */}
      {activeTab === "result" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenues */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-600" />
              <h2 className="font-semibold text-slate-800">{t("accounting.revenues")}</h2>
            </div>
            {isLoading ? (
              <div className="p-5 space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}</div>
            ) : (data?.revenueLines ?? []).length === 0 ? (
              <p className="p-5 text-slate-400 text-sm">{t("accounting.noData")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{t("accounting.account")}</th>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{t("accounting.label")}</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">{t("accounting.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.revenueLines ?? []).map((line) => (
                    <tr key={line.account} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-blue-700 font-medium">{line.account}</td>
                      <td className="px-5 py-3 text-slate-700">{line.label}</td>
                      <td className="px-5 py-3 text-right font-semibold text-emerald-700">{fmt(line.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50 border-t border-emerald-200">
                    <td colSpan={2} className="px-5 py-3 font-bold text-slate-700">Total produits</td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-700">{fmt(data?.totalRevenue ?? 0)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Expenses */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <TrendingDown size={16} className="text-red-500" />
              <h2 className="font-semibold text-slate-800">{t("accounting.expenses")}</h2>
            </div>
            {isLoading ? (
              <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}</div>
            ) : (data?.expenseLines ?? []).length === 0 ? (
              <p className="p-5 text-slate-400 text-sm">{t("accounting.noData")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{t("accounting.account")}</th>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{t("accounting.label")}</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">{t("accounting.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.expenseLines ?? []).map((line) => (
                    <tr key={line.account} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-blue-700 font-medium">{line.account}</td>
                      <td className="px-5 py-3 text-slate-700">{line.label}</td>
                      <td className="px-5 py-3 text-right font-semibold text-red-600">{fmt(line.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-red-50 border-t border-red-200">
                    <td colSpan={2} className="px-5 py-3 font-bold text-slate-700">Total charges</td>
                    <td className="px-5 py-3 text-right font-bold text-red-600">{fmt(data?.totalExpenses ?? 0)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Net result bar */}
          {!isLoading && (data?.totalRevenue ?? 0) + (data?.totalExpenses ?? 0) > 0 && (
            <div className={`lg:col-span-2 rounded-xl border p-5 ${(data?.netResult ?? 0) >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{t("accounting.netResult")} {year}</p>
                  {sciFilter !== "all" && <p className="text-xs text-slate-500 mt-0.5">{sciFilter === "personal" ? t("accounting.personalProperties") : sciFilter}</p>}
                </div>
                <p className={`text-3xl font-bold ${(data?.netResult ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {fmt(data?.netResult ?? 0)}
                </p>
              </div>
              {/* Progress bar: revenue vs expenses */}
              {(data?.totalRevenue ?? 0) > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>{t("accounting.revenues")} {fmt(data?.totalRevenue ?? 0)}</span>
                    <span>{t("accounting.expenses")} {fmt(data?.totalExpenses ?? 0)}</span>
                  </div>
                  <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(100, ((data?.totalRevenue ?? 0) / ((data?.totalRevenue ?? 0) + (data?.totalExpenses ?? 0))) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Payment Tracking ─────────────────────────────────────────────── */}
      {activeTab === "payments" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">{t("accounting.paymentTracking")}</h2>
          </div>
          {isLoading ? (
            <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}</div>
          ) : (data?.paymentTracking ?? []).length === 0 ? (
            <p className="p-5 text-slate-400 text-sm">{t("accounting.noData")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{t("accounting.tenant")}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{t("accounting.property")}</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{t("accounting.totalExpected")}</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{t("accounting.totalReceived")}</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{t("accounting.outstanding")}</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{t("accounting.collectionRate")}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Mois</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.paymentTracking ?? []).map((row, i) => {
                    const rate = row.expected > 0 ? (row.received / row.expected) * 100 : 0;
                    return (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-900 whitespace-nowrap">{row.tenantName}</td>
                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                          <span>{row.propertyName}</span>
                          <span className="text-slate-400"> · {row.lotLabel}</span>
                        </td>
                        <td className="px-5 py-3 text-right text-slate-700 whitespace-nowrap">{fmt(row.expected)}</td>
                        <td className="px-5 py-3 text-right text-emerald-700 font-semibold whitespace-nowrap">{fmt(row.received)}</td>
                        <td className={`px-5 py-3 text-right font-semibold whitespace-nowrap ${row.outstanding > 0 ? "text-red-600" : "text-slate-400"}`}>
                          {row.outstanding > 0 ? fmt(row.outstanding) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <span className={`text-sm font-medium ${rate === 100 ? "text-emerald-600" : rate >= 80 ? "text-amber-600" : "text-red-600"}`}>
                            {rate.toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1">
                            {row.events.map((ev, j) => (
                              <div key={j} title={`${ev.month} — ${ev.status} — ${fmt(ev.paidAmount)}/${fmt(ev.amount)}`}>
                                <StatusIcon status={ev.status} />
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── General Ledger ───────────────────────────────────────────────── */}
      {activeTab === "ledger" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">{t("accounting.ledger")}</h2>
          </div>
          {isLoading ? (
            <div className="p-5 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}</div>
          ) : (data?.ledger ?? []).length === 0 ? (
            <p className="p-5 text-slate-400 text-sm">{t("accounting.noData")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t("accounting.account")}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t("accounting.label")}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Description</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Débit</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.ledger ?? []).map((entry, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-2.5 text-slate-500 whitespace-nowrap text-xs">{entry.date}</td>
                      <td className="px-5 py-2.5 font-mono text-blue-700 font-medium text-xs">{entry.account}</td>
                      <td className="px-5 py-2.5 text-slate-600 text-xs max-w-40 truncate">{entry.label}</td>
                      <td className="px-5 py-2.5 text-slate-700 text-xs max-w-48 truncate">{entry.description}</td>
                      <td className="px-5 py-2.5 text-right text-red-600 font-medium whitespace-nowrap text-xs">
                        {entry.type === "debit" ? fmt(entry.amount) : ""}
                      </td>
                      <td className="px-5 py-2.5 text-right text-emerald-600 font-medium whitespace-nowrap text-xs">
                        {entry.type === "credit" ? fmt(entry.amount) : ""}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-slate-100 border-t border-slate-300 font-bold">
                    <td colSpan={4} className="px-5 py-3 text-slate-700 text-sm">Total</td>
                    <td className="px-5 py-3 text-right text-red-700 text-sm whitespace-nowrap">{fmt(data?.totalExpenses ?? 0)}</td>
                    <td className="px-5 py-3 text-right text-emerald-700 text-sm whitespace-nowrap">{fmt(data?.totalRevenue ?? 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
