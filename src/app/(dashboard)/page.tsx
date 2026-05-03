"use client";

import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import {
  Building2,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Home,
  PieChart,
  AlertCircle,
  ChevronRight,
  Info,
} from "lucide-react";
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
      lot: { label: string; property: { name: string } };
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

function StatCard({
  label,
  value,
  icon: Icon,
  subtext,
  accent = "blue",
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  subtext?: string;
  accent?: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className={`p-2 rounded-lg ${colors[accent]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subtext && <p className="text-sm text-slate-500 mt-1">{subtext}</p>}
    </div>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A: "bg-emerald-100 text-emerald-700 border-emerald-200",
    B: "bg-blue-100 text-blue-700 border-blue-200",
    C: "bg-amber-100 text-amber-700 border-amber-200",
    D: "bg-orange-100 text-orange-700 border-orange-200",
    F: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-lg font-bold border ${colors[grade] || colors.C}`}
    >
      {grade}
    </span>
  );
}

export default function DashboardPage() {
  const { t } = useI18n();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard", "stats"],
    queryFn: () => fetch("/api/dashboard/stats").then((r) => r.json()),
  });

  const { data: wealthScore, isLoading: scoreLoading } = useQuery<WealthScore>({
    queryKey: ["dashboard", "wealth-score"],
    queryFn: () => fetch("/api/dashboard/wealth-score").then((r) => r.json()),
  });

  if (statsLoading || scoreLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">{t("dashboard.title")}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
              <div className="h-8 bg-slate-200 rounded w-3/4" />
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

  // Count total actions needed
  const actionsCount = s.latePaymentsCount + (s.propertiesMissingType > 0 ? 1 : 0) + (s.propertiesMissingValue > 0 ? 1 : 0) + (s.vacantLots > 0 ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("dashboard.title")}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{t("dashboard.wealthScore")}</span>
          <GradeBadge grade={ws.grade} />
          <span className="text-lg font-bold text-slate-900">{ws.total}/100</span>
        </div>
      </div>

      {/* Actions Required Banner */}
      {actionsCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={18} className="text-amber-600" />
            <h3 className="font-semibold text-amber-900">{t("dashboard.actionsRequired")} ({actionsCount})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {s.latePaymentsCount > 0 && (
              <Link href="/notifications" className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 transition-colors group">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-sm text-slate-700">
                    <strong>{s.latePaymentsCount}</strong> {t("dashboard.unpaidRents")}
                    {s.totalOutstanding > 0 && <span className="text-red-600 ml-1">({formatCurrency(s.totalOutstanding)})</span>}
                  </span>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-amber-600" />
              </Link>
            )}
            {s.vacantLots > 0 && (
              <Link href="/properties" className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 transition-colors group">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm text-slate-700"><strong>{s.vacantLots}</strong> {t("dashboard.vacantLots")}</span>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-amber-600" />
              </Link>
            )}
            {s.propertiesMissingType > 0 && (
              <Link href="/properties" className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 transition-colors group">
                <div className="flex items-center gap-2">
                  <Info size={14} className="text-blue-500" />
                  <span className="text-sm text-slate-700"><strong>{s.propertiesMissingType}</strong> {t("dashboard.propertiesMissingType")}</span>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-amber-600" />
              </Link>
            )}
            {s.propertiesMissingValue > 0 && (
              <Link href="/properties" className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 transition-colors group">
                <div className="flex items-center gap-2">
                  <Info size={14} className="text-blue-500" />
                  <span className="text-sm text-slate-700"><strong>{s.propertiesMissingValue}</strong> {t("dashboard.propertiesMissingValue")}</span>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-amber-600" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("dashboard.totalNetWorth")}
          value={formatCurrency(s.totalNetWorth)}
          icon={PieChart}
          subtext={`${t("dashboard.realEstate")} ${formatCurrency(s.totalRealEstateValue)} | ${t("dashboard.investments")} ${formatCurrency(s.totalInvestmentValue)}`}
          accent="purple"
        />
        <StatCard
          label={t("dashboard.monthlyIncome")}
          value={formatCurrency(s.totalExpectedMonthlyIncome)}
          icon={DollarSign}
          subtext={`${t("dashboard.collected")} ${formatCurrency(s.totalCollectedThisMonth)}`}
          accent="green"
        />
        <StatCard
          label={t("dashboard.occupancyRate")}
          value={`${(s.occupancyRate * 100).toFixed(0)}%`}
          icon={Home}
          subtext={`${s.totalProperties} ${t("dashboard.properties")}, ${s.totalLots} ${t("dashboard.lots")}`}
          accent="blue"
        />
        <StatCard
          label={t("dashboard.latePayments")}
          value={String(s.latePaymentsCount)}
          icon={AlertTriangle}
          subtext={s.latePaymentsCount > 0 ? `${t("dashboard.totalOutstanding")}: ${formatCurrency(s.totalOutstanding)}` : t("dashboard.allOnTrack")}
          accent={s.latePaymentsCount > 0 ? "red" : "green"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wealth Score Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-medium text-slate-500 mb-4">{t("dashboard.wealthBreakdown")}</h3>
          <div className="space-y-3">
            {[
              { label: t("dashboard.occupancy"), value: ws.occupancyScore, max: 30 },
              { label: t("dashboard.incomeRegularity"), value: ws.incomeRegularity, max: 25 },
              { label: t("dashboard.diversification"), value: ws.diversification, max: 20 },
              { label: t("dashboard.growth"), value: ws.growthTrend, max: 15 },
              { label: t("dashboard.base"), value: ws.base, max: 10 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="font-medium text-slate-900">
                    {item.value}/{item.max}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(item.value / item.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Late Payments Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">{t("dashboard.latePayments")}</h3>
            <Link href="/notifications" className="text-sm text-blue-600 hover:underline">
              {t("dashboard.viewAll")}
            </Link>
          </div>
          {s.lateRentEvents && s.lateRentEvents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-2 font-medium">{t("dashboard.property")}</th>
                    <th className="pb-2 font-medium">{t("dashboard.tenant")}</th>
                    <th className="pb-2 font-medium">{t("dashboard.dueDate")}</th>
                    <th className="pb-2 font-medium text-right">{t("dashboard.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.lateRentEvents.slice(0, 5).map((event) => {
                    const dueDate = new Date(event.dueDate);
                    const now = new Date();
                    const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={event.id} className="border-b border-slate-50">
                        <td className="py-2.5">
                          <span className="font-medium text-slate-900">
                            {event.lease?.lot?.property?.name}
                          </span>
                          <span className="text-slate-400 ml-1">
                            {event.lease?.lot?.label}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-600">
                          {event.lease?.tenant?.firstName} {event.lease?.tenant?.lastName}
                        </td>
                        <td className="py-2.5">
                          <span className="text-red-600 font-medium">{event.dueDate}</span>
                          {daysLate > 0 && (
                            <span className="text-xs text-red-400 ml-1">({daysLate} {t("dashboard.delayDays")})</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-medium text-slate-900">
                          {formatCurrency(event.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <AlertTriangle size={24} className="mx-auto mb-2 opacity-50" />
              <p>{t("dashboard.noLatePayments")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/properties/new"
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <Building2 size={24} className="text-blue-500 mb-3" />
          <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">{t("dashboard.addProperty")}</h3>
          <p className="text-sm text-slate-500 mt-1">{t("dashboard.addPropertyDesc")}</p>
        </Link>
        <Link
          href="/tenants"
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <TrendingUp size={24} className="text-emerald-500 mb-3" />
          <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">{t("dashboard.manageTenants")}</h3>
          <p className="text-sm text-slate-500 mt-1">{t("dashboard.manageTenantsDesc")}</p>
        </Link>
        <Link
          href="/investments"
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <DollarSign size={24} className="text-purple-500 mb-3" />
          <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">{t("dashboard.investmentsAction")}</h3>
          <p className="text-sm text-slate-500 mt-1">{t("dashboard.investmentsDesc")}</p>
        </Link>
      </div>
    </div>
  );
}
