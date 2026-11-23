"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Wrench,
  TrendingUp,
  Bell,
  Clock,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  BookOpen,
  Percent,
  CheckSquare,
  HardHat,
  Banknote,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface ModuleState {
  module: string;
  isActive: boolean;
}

type NavItem = {
  labelKey: TranslationKey;
  href: string;
  icon: typeof LayoutDashboard;
  module?: string;
  badge?: "overdue";
};

type NavGroup = { labelKey?: TranslationKey; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    items: [{ labelKey: "nav.dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    labelKey: "nav.group.rental",
    items: [
      { labelKey: "nav.properties", href: "/properties", icon: Building2 },
      { labelKey: "nav.tenants", href: "/tenants", icon: Users },
      { labelKey: "nav.rents", href: "/loyers", icon: Banknote, badge: "overdue" },
      { labelKey: "nav.documents", href: "/documents", icon: FileText },
      { labelKey: "nav.expenses", href: "/expenses", icon: Receipt, module: "EXPENSES" },
      { labelKey: "nav.works", href: "/works", icon: Wrench, module: "WORKS" },
    ],
  },
  {
    labelKey: "nav.group.organisation",
    items: [
      { labelKey: "nav.tasks", href: "/tasks", icon: CheckSquare },
      { labelKey: "nav.contractors", href: "/contractors", icon: HardHat },
    ],
  },
  {
    labelKey: "nav.group.finance",
    items: [
      { labelKey: "nav.investments", href: "/investments", icon: TrendingUp },
      { labelKey: "nav.accounting", href: "/comptabilite", icon: BookOpen },
      { labelKey: "nav.fiscalite", href: "/fiscalite", icon: Percent },
    ],
  },
  {
    labelKey: "nav.group.follow",
    items: [
      { labelKey: "nav.timeline", href: "/timeline", icon: Clock },
      { labelKey: "nav.notifications", href: "/notifications", icon: Bell },
    ],
  },
];

const settingsItem: NavItem = { labelKey: "nav.settings", href: "/settings", icon: Settings };

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useI18n();

  const { data: modules = [] } = useQuery<ModuleState[]>({
    queryKey: ["modules"],
    queryFn: () => fetch("/api/modules").then((r) => r.json()),
  });

  // Nombre de loyers impayés, affiché à côté de « Loyers »
  const { data: rents } = useQuery<{ totals: { overdueCount: number } }>({
    queryKey: ["rents"],
    queryFn: () => fetch("/api/rents").then((r) => (r.ok ? r.json() : null)),
    staleTime: 60_000,
  });
  const overdueCount = rents?.totals?.overdueCount ?? 0;

  const isModuleActive = (mod: string) => modules.find((m) => m.module === mod)?.isActive ?? false;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? t(item.labelKey) : undefined}
        className={cn(
          "flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13px] transition-colors",
          collapsed && "justify-center px-0",
          active
            ? "bg-white text-slate-900 font-medium border border-slate-200"
            : "text-slate-600 border border-transparent hover:text-slate-900 hover:bg-slate-200/60"
        )}
      >
        <item.icon size={16} strokeWidth={1.75} className={active ? "text-blue-600" : "text-slate-500"} />
        {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
        {!collapsed && item.badge === "overdue" && overdueCount > 0 && (
          <span className="ml-auto min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-red-600 text-white text-[11px] font-medium tabular-nums">
            {overdueCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "h-screen bg-slate-100 flex flex-col border-r border-slate-200 transition-[width] duration-200 shrink-0",
        collapsed ? "w-14" : "w-60"
      )}
    >
      <div className={cn("flex items-center h-14 px-3", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2 px-1">
            <span className="grid place-items-center w-6 h-6 rounded-[5px] bg-blue-700 text-white text-[11px] font-semibold tracking-tight">
              W
            </span>
            <span className="text-[15px] font-semibold text-slate-900 tracking-tight">WealthOS</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          title={collapsed ? t("nav.expand") : t("nav.collapse")}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
        {navGroups.map((group, i) => {
          const items = group.items.filter((item) => !item.module || isModuleActive(item.module));
          if (items.length === 0) return null;
          return (
            <div key={i} className="space-y-0.5">
              {group.labelKey && !collapsed && (
                <p className="px-2.5 pt-1 pb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">
                  {t(group.labelKey)}
                </p>
              )}
              {group.labelKey && collapsed && <div className="mx-2 my-2 border-t border-slate-200" />}
              {items.map(renderItem)}
            </div>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-slate-200">{renderItem(settingsItem)}</div>
    </aside>
  );
}
