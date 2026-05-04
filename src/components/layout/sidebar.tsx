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
  ChevronLeft,
  ChevronRight,
  Receipt,
  BookOpen,
  Percent,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface ModuleState {
  module: string;
  isActive: boolean;
}

const coreNavItems: { labelKey: TranslationKey; href: string; icon: typeof LayoutDashboard }[] = [
  { labelKey: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { labelKey: "nav.properties", href: "/properties", icon: Building2 },
  { labelKey: "nav.tenants", href: "/tenants", icon: Users },
  { labelKey: "nav.documents", href: "/documents", icon: FileText },
];

const moduleNavItems: { labelKey: TranslationKey; href: string; icon: typeof LayoutDashboard; module: string }[] = [
  { labelKey: "nav.expenses", href: "/expenses", icon: Receipt, module: "EXPENSES" },
  { labelKey: "nav.works", href: "/works", icon: Wrench, module: "WORKS" },
];

const otherNavItems: { labelKey: TranslationKey; href: string; icon: typeof LayoutDashboard }[] = [
  { labelKey: "nav.investments", href: "/investments", icon: TrendingUp },
  { labelKey: "nav.accounting", href: "/comptabilite", icon: BookOpen },
  { labelKey: "nav.fiscalite", href: "/fiscalite", icon: Percent },
  { labelKey: "nav.timeline", href: "/timeline", icon: Clock },
  { labelKey: "nav.notifications", href: "/notifications", icon: Bell },
];

const bottomItems: { labelKey: TranslationKey; href: string; icon: typeof Settings }[] = [
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useI18n();

  const { data: modules = [] } = useQuery<ModuleState[]>({
    queryKey: ["modules"],
    queryFn: () => fetch("/api/modules").then((r) => r.json()),
  });

  const isModuleActive = (mod: string) => modules.find((m) => m.module === mod)?.isActive ?? false;

  // Build full nav: core + active module items + other items
  const navItems = [
    ...coreNavItems,
    ...moduleNavItems.filter((item) => isModuleActive(item.module)),
    ...otherNavItems,
  ];

  return (
    <aside
      className={cn(
        "h-screen bg-slate-900 text-white flex flex-col transition-all duration-300 border-r border-slate-800",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800">
        {!collapsed && (
          <Link href="/" className="text-lg font-bold tracking-tight">
            Wealth<span className="text-blue-400">OS</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <item.icon size={20} />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="py-4 px-2 border-t border-slate-800">
        {bottomItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <item.icon size={20} />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
