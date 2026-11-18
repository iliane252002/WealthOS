"use client";

import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface DashboardStats {
  totalRealEstateValue: number;
  totalInvestmentValue: number;
  totalNetWorth: number;
  totalExpectedMonthlyIncome: number;
  totalCollectedThisMonth: number;
  latePaymentsCount: number;
  occupancyRate: number;
  totalProperties: number;
  totalLots: number;
  totalOutstanding: number;
  propertiesMissingType: number;
  propertiesMissingValue: number;
  vacantLots: number;
  lateRentEvents: Array<{
    id: string;
    dueDate: string;
    amount: number;
    lease: {
      lot: { id: string; label: string; property: { id: string; name: string } };
      tenant: { firstName: string; lastName: string };
    };
  }>;
}

interface WealthScore {
  occupancyScore: number;
  incomeRegularity: number;
  diversification: number;
  growthTrend: number;
  base: number;
  total: number;
  grade: string;
}

function formatDate(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Kpi({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "negative";
}) {
  return (
    <div className="px-5 py-4 min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{label}</p>
      <p
        className={`mt-2 text-[26px] leading-none font-semibold tabular-nums ${
          tone === "negative" ? "text-red-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {detail && <p className="mt-2 text-[13px] text-slate-500">{detail}</p>}
    </div>
  );
}

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white border border-slate-200 rounded-lg min-w-0 ${className}`}>
      <header className="flex items-center justify-between h-11 px-5 border-b border-slate-200">
        <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const { t, locale } = useI18n();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard", "stats"],
    queryFn: () => fetch("/api/dashboard/stats").then((r) => r.json()),
  });

  const { data: wealthScore, isLoading: scoreLoading } = useQuery<WealthScore>({
    queryKey: ["dashboard", "wealth-score"],
    queryFn: () => fetch("/api/dashboard/wealth-score").then((r) => r.json()),
  });

  const today = new Date().toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-semibold text-slate-900">{t("dashboard.title")}</h1>
        <p className="mt-1 text-[13px] text-slate-500 first-letter:uppercase">{today}</p>
      </div>
      <Link
        href="/properties/new"
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-blue-700 text-white text-[13px] font-medium hover:bg-blue-800 transition-colors"
      >
        <Plus size={14} />
        {t("dashboard.addProperty")}
      </Link>
    </div>
  );

  if (statsLoading || scoreLoading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="bg-white border border-slate-200 rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-200 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-5 py-4">
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
              <div className="h-6 bg-slate-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const s = stats || {
    totalNetWorth: 0,
    totalExpectedMonthlyIncome: 0,
    occupancyRate: 0,
    latePaymentsCount: 0,
    totalRealEstateValue: 0,
    totalInvestmentValue: 0,
    totalCollectedThisMonth: 0,
    totalProperties: 0,
    totalLots: 0,
    lateRentEvents: [],
    totalOutstanding: 0,
    propertiesMissingType: 0,
    propertiesMissingValue: 0,
    vacantLots: 0,
  };

  const ws = wealthScore || { total: 0, grade: "F", occupancyScore: 0, incomeRegularity: 0, diversification: 0, growthTrend: 0, base: 10 };

  const todo: { key: string; tone: "critical" | "warning" | "info"; text: React.ReactNode; amount?: string; href: string }[] = [];
  if (s.latePaymentsCount > 0)
    todo.push({
      key: "late",
      tone: "critical",
      text: (
        <>
          <span className="font-semibold tabular-nums">{s.latePaymentsCount}</span> {t("dashboard.unpaidRents").toLowerCase()}
        </>
      ),
      amount: s.totalOutstanding > 0 ? formatCurrency(s.totalOutstanding) : undefined,
      href: "/comptabilite",
    });
  if (s.vacantLots > 0)
    todo.push({
      key: "vacant",
      tone: "warning",
      text: (
        <>
          <span className="font-semibold tabular-nums">{s.vacantLots}</span> {t("dashboard.vacantLots")}
        </>
      ),
      href: "/properties",
    });
  if (s.propertiesMissingType > 0)
    todo.push({
      key: "type",
      tone: "info",
      text: (
        <>
          <span className="font-semibold tabular-nums">{s.propertiesMissingType}</span> {t("dashboard.propertiesMissingType")}
        </>
      ),
      href: "/properties",
    });
  if (s.propertiesMissingValue > 0)
    todo.push({
      key: "value",
      tone: "info",
      text: (
        <>
          <span className="font-semibold tabular-nums">{s.propertiesMissingValue}</span> {t("dashboard.propertiesMissingValue")}
        </>
      ),
      href: "/properties",
    });

  const toneDot = { critical: "bg-red-600", warning: "bg-amber-500", info: "bg-slate-400" };

  const scoreRows = [
    { label: t("dashboard.occupancy"), value: ws.occupancyScore, max: 30 },
    { label: t("dashboard.incomeRegularity"), value: ws.incomeRegularity, max: 25 },
    { label: t("dashboard.diversification"), value: ws.diversification, max: 20 },
    { label: t("dashboard.growth"), value: ws.growthTrend, max: 15 },
    { label: t("dashboard.base"), value: ws.base, max: 10 },
  ];

  const collectedShare =
    s.totalExpectedMonthlyIncome > 0 ? Math.min(1, s.totalCollectedThisMonth / s.totalExpectedMonthlyIncome) : 0;

  return (
    <div className="space-y-6">
      {header}

      {/* Chiffres clés */}
      <div className="bg-slate-200 border border-slate-200 rounded-lg overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px [&>*]:bg-white">
        <Kpi
          label={t("dashboard.totalNetWorth")}
          value={formatCurrency(s.totalNetWorth)}
          detail={`${t("dashboard.realEstate")} ${formatCurrency(s.totalRealEstateValue)} · ${t("dashboard.investments")} ${formatCurrency(s.totalInvestmentValue)}`}
        />
        <div className="px-5 py-4 min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t("dashboard.monthlyIncome")}</p>
          <p className="mt-2 text-[26px] leading-none font-semibold tabular-nums text-slate-900">
            {formatCurrency(s.totalExpectedMonthlyIncome)}
          </p>
          <div className="mt-3 h-1 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-600" style={{ width: `${collectedShare * 100}%` }} />
          </div>
          <p className="mt-1.5 text-[13px] text-slate-500 truncate">
            {t("dashboard.collected")} <span className="tabular-nums text-slate-700">{formatCurrency(s.totalCollectedThisMonth)}</span>
          </p>
        </div>
        <Kpi
          label={t("dashboard.occupancyRate")}
          value={`${(s.occupancyRate * 100).toFixed(0)} %`}
          detail={`${s.totalProperties} ${t("dashboard.properties")} · ${s.totalLots} ${t("dashboard.lots")}`}
        />
        <Kpi
          label={t("dashboard.totalOutstanding")}
          value={formatCurrency(s.totalOutstanding)}
          detail={
            s.latePaymentsCount > 0
              ? `${s.latePaymentsCount} ${t("dashboard.unpaidRents").toLowerCase()}`
              : t("dashboard.allOnTrack")
          }
          tone={s.totalOutstanding > 0 ? "negative" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <Panel
            title={t("dashboard.latePayments")}
            action={
              <Link href="/comptabilite" className="text-[13px] text-blue-600 hover:text-blue-800">
                {t("dashboard.viewAll")}
              </Link>
            }
          >
            {s.lateRentEvents && s.lateRentEvents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-slate-500 border-b border-slate-200">
                      <th className="px-5 py-2.5 font-medium">{t("dashboard.property")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("dashboard.tenant")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("dashboard.dueDate")}</th>
                      <th className="px-5 py-2.5 font-medium text-right">{t("dashboard.amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.lateRentEvents.slice(0, 5).map((event) => {
                      const dueDate = new Date(event.dueDate);
                      const now = new Date();
                      const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                      const lotUrl =
                        event.lease?.lot?.property?.id && event.lease?.lot?.id
                          ? `/properties/${event.lease.lot.property.id}/lots/${event.lease.lot.id}`
                          : null;
                      return (
                        <tr
                          key={event.id}
                          className={`border-b border-slate-100 last:border-0 ${lotUrl ? "cursor-pointer hover:bg-slate-50" : ""}`}
                          onClick={() => lotUrl && (window.location.href = lotUrl)}
                        >
                          <td className="px-5 py-2.5">
                            <div className="text-slate-900 font-medium">{event.lease?.lot?.property?.name}</div>
                            <div className="text-slate-500 text-xs">{event.lease?.lot?.label}</div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">
                            {event.lease?.tenant?.firstName} {event.lease?.tenant?.lastName}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            <div className="text-slate-900">{formatDate(event.dueDate, locale)}</div>
                            {daysLate > 0 && (
                              <div className="text-xs text-red-600">
                                {daysLate}
                                {t("dashboard.daysLate")}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-2.5 text-right font-medium tabular-nums text-slate-900">
                            {formatCurrency(event.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {s.latePaymentsCount > 5 && (
                  <p className="px-5 py-2.5 text-xs text-slate-500 border-t border-slate-200">
                    {t("dashboard.showing")} <span className="tabular-nums">{s.latePaymentsCount}</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="px-5 py-8 text-[13px] text-slate-500">{t("dashboard.noLatePayments")}</p>
            )}
          </Panel>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6 min-w-0">
          <Panel title={t("dashboard.toHandle")}>
            {todo.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {todo.map((item) => (
                  <li key={item.key}>
                    <Link href={item.href} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 group">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${toneDot[item.tone]}`} />
                      <span className="flex-1 min-w-0 text-[13px] text-slate-700">{item.text}</span>
                      {item.amount && (
                        <span className="text-[13px] tabular-nums text-red-600 font-medium">{item.amount}</span>
                      )}
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-[13px] text-slate-500">{t("dashboard.nothingToHandle")}</p>
            )}
          </Panel>

          <Panel
            title={t("dashboard.wealthScore")}
            action={
              <span className="text-[13px] text-slate-500">
                <span className="font-semibold text-slate-900 tabular-nums">{ws.total}</span> {t("dashboard.scoreOutOf")}
              </span>
            }
          >
            <dl className="px-5 py-4 space-y-3">
              {scoreRows.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-[13px]">
                    <dt className="text-slate-600">{item.label}</dt>
                    <dd className="tabular-nums text-slate-900">
                      {item.value}
                      <span className="text-slate-400"> / {item.max}</span>
                    </dd>
                  </div>
                  <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600" style={{ width: `${(item.value / item.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
