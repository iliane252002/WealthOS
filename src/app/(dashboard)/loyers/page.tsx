"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Phone } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn, fetchJson, formatCurrency, formatDate } from "@/lib/utils";
import { isoToday } from "@/components/investments/dates";

interface RentRow {
  id: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  paidDate: string | null;
  status: string;
  remaining: number;
  tenant: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null };
  lot: { id: string; label: string };
  property: { id: string; name: string };
  leaseActive: boolean;
}

interface RentsData {
  today: string;
  month: string;
  overdue: RentRow[];
  thisMonth: RentRow[];
  totals: {
    overdueAmount: number;
    overdueCount: number;
    overdueTenants: number;
    monthExpected: number;
    monthCollected: number;
  };
}

type Tab = "overdue" | "month";

function daysLate(dueDate: string, today: string) {
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(dueDate)) / 86_400_000));
}

const th = "px-3 py-2.5 font-medium";

export default function RentsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overdue");
  const [propertyId, setPropertyId] = useState("");
  const [partialFor, setPartialFor] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState("");

  const { data, isLoading, isError } = useQuery<RentsData>({
    queryKey: ["rents"],
    queryFn: () => fetchJson<RentsData>("/api/rents"),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["rents"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["lots"] });
  };

  const pay = useMutation({
    mutationFn: async (items: Array<{ id: string; paidAmount: number; status?: string; paidDate?: string | null }>) => {
      const results = await Promise.all(
        items.map((item) =>
          fetch(`/api/rent-events/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paidAmount: item.paidAmount,
              ...(item.status ? { status: item.status } : {}),
              paidDate: item.paidDate === undefined ? isoToday() : item.paidDate,
            }),
          })
        )
      );
      if (results.some((r) => !r.ok)) throw new Error("update failed");
    },
    onSuccess: () => {
      setPartialFor(null);
      setPartialAmount("");
      refresh();
    },
  });

  const properties = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of [...(data?.overdue ?? []), ...(data?.thisMonth ?? [])]) map.set(r.property.id, r.property.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const filter = (rows: RentRow[]) => (propertyId ? rows.filter((r) => r.property.id === propertyId) : rows);
  const overdue = filter(data?.overdue ?? []);
  const thisMonth = filter(data?.thisMonth ?? []);
  const today = data?.today ?? isoToday();

  // Impayés regroupés par locataire, le plus gros montant dû en premier
  const groups = useMemo(() => {
    const map = new Map<string, { tenant: RentRow["tenant"]; rows: RentRow[]; total: number }>();
    for (const r of overdue) {
      const g = map.get(r.tenant.id) ?? { tenant: r.tenant, rows: [], total: 0 };
      g.rows.push(r);
      g.total += r.remaining;
      map.set(r.tenant.id, g);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [overdue]);

  const totals = useMemo(() => {
    const monthExpected = thisMonth.reduce((s, r) => s + r.amount, 0);
    const monthCollected = thisMonth.reduce((s, r) => s + Math.min(r.paidAmount, r.amount), 0);
    return {
      overdueAmount: overdue.reduce((s, r) => s + r.remaining, 0),
      overdueCount: overdue.length,
      overdueTenants: groups.length,
      monthExpected,
      monthCollected,
    };
  }, [overdue, thisMonth, groups]);

  const markPaid = (r: RentRow) => pay.mutate([{ id: r.id, paidAmount: r.amount }]);
  const undo = (r: RentRow) =>
    pay.mutate([{ id: r.id, paidAmount: 0, status: r.dueDate < today ? "LATE" : "PENDING", paidDate: null }]);
  const submitPartial = (r: RentRow) => {
    const received = Number(partialAmount.replace(",", "."));
    if (!Number.isFinite(received) || received <= 0) return;
    pay.mutate([{ id: r.id, paidAmount: Math.min(r.amount, r.paidAmount + received) }]);
  };

  const lotUrl = (r: RentRow) => `/properties/${r.property.id}/lots/${r.lot.id}`;

  const actions = (r: RentRow) =>
    partialFor === r.id ? (
      <form
        className="flex items-center justify-end gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          submitPartial(r);
        }}
      >
        <input
          autoFocus
          inputMode="decimal"
          value={partialAmount}
          onChange={(e) => setPartialAmount(e.target.value)}
          placeholder={t("rents.received")}
          aria-label={t("rents.received")}
          className="w-28 h-7 px-2 text-[13px] border border-slate-300 rounded-md tabular-nums"
        />
        <button type="submit" disabled={pay.isPending} className="h-7 px-2.5 text-[12px] font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {t("rents.confirm")}
        </button>
        <button type="button" onClick={() => setPartialFor(null)} className="h-7 px-2 text-[12px] text-slate-500 hover:text-slate-800">
          {t("rents.cancel")}
        </button>
      </form>
    ) : (
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={() => {
            setPartialFor(r.id);
            setPartialAmount("");
          }}
          className="h-7 px-2.5 text-[12px] font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          {t("rents.partial")}
        </button>
        <button
          onClick={() => markPaid(r)}
          disabled={pay.isPending}
          className="h-7 px-2.5 text-[12px] font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {t("rents.markPaid")}
        </button>
      </div>
    );

  const statusBadge = (r: RentRow) => {
    if (r.status === "PAID" || r.paidAmount >= r.amount)
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          {r.paidDate ? t("rents.statusPaid").replace("{d}", formatDate(r.paidDate)) : t("rents.statusPaidShort")}
        </span>
      );
    const late = r.dueDate < today;
    if (r.paidAmount > 0)
      return (
        <span className="inline-flex items-center gap-1.5 text-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {t("rents.statusPartial")} · {formatCurrency(r.remaining)} {t("rents.remaining").toLowerCase()}
        </span>
      );
    if (late)
      return (
        <span className="inline-flex items-center gap-1.5 text-red-700">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
          {t("rents.statusLate")} · {t("rents.days").replace("{n}", String(daysLate(r.dueDate, today)))}
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1.5 text-slate-600">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        {r.status === "DUE" ? t("rents.statusDue") : t("rents.statusPending")}
      </span>
    );
  };

  const propertyCell = (r: RentRow) => (
    <Link href={lotUrl(r)} className="group block">
      <span className="text-slate-900 group-hover:text-blue-700">{r.property.name}</span>
      <span className="block text-xs text-slate-500">
        {r.lot.label}
        {!r.leaseActive && ` · ${t("rents.endedLease")}`}
      </span>
    </Link>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-slate-900">{t("rents.title")}</h1>
        <p className="mt-1 text-[13px] text-slate-500">{t("rents.subtitle")}</p>
      </div>

      {isError && (
        <div className="border border-red-200 bg-red-50 text-red-800 text-[13px] rounded-lg px-4 py-3">{t("rents.error")}</div>
      )}

      {/* Chiffres clés */}
      <div className="bg-slate-200 border border-slate-200 rounded-lg overflow-hidden grid grid-cols-1 sm:grid-cols-3 gap-px [&>*]:bg-white">
        <div className="px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t("rents.kpiOverdue")}</p>
          <p className={cn("mt-2 text-[26px] leading-none font-semibold tabular-nums", totals.overdueAmount > 0 ? "text-red-600" : "text-slate-900")}>
            {isLoading ? "—" : formatCurrency(totals.overdueAmount)}
          </p>
          <p className="mt-2 text-[13px] text-slate-500 tabular-nums">
            {t("rents.kpiOverdueDetail").replace("{n}", String(totals.overdueCount)).replace("{t}", String(totals.overdueTenants))}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t("rents.kpiCollected")}</p>
          <p className="mt-2 text-[26px] leading-none font-semibold tabular-nums text-slate-900">
            {isLoading ? "—" : formatCurrency(totals.monthCollected)}
          </p>
          <div className="mt-3 h-1 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-blue-600"
              style={{ width: `${totals.monthExpected > 0 ? Math.min(100, (totals.monthCollected / totals.monthExpected) * 100) : 0}%` }}
            />
          </div>
          <p className="mt-1.5 text-[13px] text-slate-500 tabular-nums">
            {t("rents.kpiExpected").replace("{x}", formatCurrency(totals.monthExpected))}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t("rents.kpiRemaining")}</p>
          <p className="mt-2 text-[26px] leading-none font-semibold tabular-nums text-slate-900">
            {isLoading ? "—" : formatCurrency(Math.max(0, totals.monthExpected - totals.monthCollected))}
          </p>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 h-auto py-2 border-b border-slate-200">
          <div className="flex gap-1" role="tablist">
            {(["overdue", "month"] as Tab[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn(
                  "h-8 px-3 text-[13px] rounded-md",
                  tab === k ? "bg-slate-100 text-slate-900 font-medium" : "text-slate-500 hover:text-slate-800"
                )}
              >
                {k === "overdue" ? t("rents.tabOverdue") : t("rents.tabMonth")}
                <span className="ml-1.5 tabular-nums text-slate-400">{k === "overdue" ? overdue.length : thisMonth.length}</span>
              </button>
            ))}
          </div>
          {properties.length > 1 && (
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="h-8 px-2 text-[13px] border border-slate-300 rounded-md bg-white"
              aria-label={t("rents.property")}
            >
              <option value="">{t("rents.allProperties")}</option>
              {properties.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </header>

        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-4 bg-slate-100 rounded" />
            ))}
          </div>
        ) : tab === "overdue" ? (
          groups.length === 0 ? (
            <p className="px-5 py-10 text-[13px] text-slate-500">{t("rents.noOverdue")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-slate-500 border-b border-slate-200">
                    <th className="px-5 py-2.5 font-medium">{t("rents.dueDate")}</th>
                    <th className={th}>{t("rents.property")}</th>
                    <th className={`${th} text-right`}>{t("rents.amount")}</th>
                    <th className={`${th} text-right`}>{t("rents.paid")}</th>
                    <th className={`${th} text-right`}>{t("rents.remaining")}</th>
                    <th className={`${th} text-right`}>{t("rents.delay")}</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g.tenant.id} className="border-b border-slate-200 last:border-0">
                    <tr className="bg-slate-50">
                      <td colSpan={7} className="px-5 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="font-semibold text-slate-900">
                              {g.tenant.firstName} {g.tenant.lastName}
                            </span>
                            <span className="text-slate-500 tabular-nums">
                              {t("rents.tenantTotal").replace("{n}", String(g.rows.length)).replace("{x}", formatCurrency(g.total))}
                            </span>
                            {g.tenant.phone && (
                              <a href={`tel:${g.tenant.phone}`} className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-700">
                                <Phone size={12} /> {g.tenant.phone}
                              </a>
                            )}
                            {g.tenant.email && (
                              <a href={`mailto:${g.tenant.email}`} className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-700">
                                <Mail size={12} /> {g.tenant.email}
                              </a>
                            )}
                          </div>
                          {g.rows.length > 1 && (
                            <button
                              onClick={() => pay.mutate(g.rows.map((r) => ({ id: r.id, paidAmount: r.amount })))}
                              disabled={pay.isPending}
                              className="h-7 px-2.5 text-[12px] font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                              {t("rents.payAll")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-5 py-2.5 tabular-nums text-slate-900">{formatDate(r.dueDate)}</td>
                        <td className="px-3 py-2.5">{propertyCell(r)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatCurrency(r.amount)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{r.paidAmount > 0 ? formatCurrency(r.paidAmount) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-red-700">{formatCurrency(r.remaining)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-red-600">
                          {t("rents.days").replace("{n}", String(daysLate(r.dueDate, today)))}
                        </td>
                        <td className="px-5 py-2">{actions(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )
        ) : thisMonth.length === 0 ? (
          <p className="px-5 py-10 text-[13px] text-slate-500">{t("rents.noMonth")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-slate-500 border-b border-slate-200">
                  <th className="px-5 py-2.5 font-medium">{t("rents.tenant")}</th>
                  <th className={th}>{t("rents.property")}</th>
                  <th className={th}>{t("rents.dueDate")}</th>
                  <th className={`${th} text-right`}>{t("rents.amount")}</th>
                  <th className={th}>{t("rents.status")}</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {thisMonth.map((r) => {
                  const paid = r.status === "PAID" || r.paidAmount >= r.amount;
                  return (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-2.5 text-slate-900 font-medium">
                        {r.tenant.firstName} {r.tenant.lastName}
                      </td>
                      <td className="px-3 py-2.5">{propertyCell(r)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-700">{formatDate(r.dueDate)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-900">{formatCurrency(r.amount)}</td>
                      <td className="px-3 py-2.5">{statusBadge(r)}</td>
                      <td className="px-5 py-2">
                        {paid ? (
                          <div className="flex justify-end">
                            <button onClick={() => undo(r)} disabled={pay.isPending} className="h-7 px-2 text-[12px] text-slate-500 hover:text-slate-800">
                              {t("rents.undo")}
                            </button>
                          </div>
                        ) : (
                          actions(r)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
