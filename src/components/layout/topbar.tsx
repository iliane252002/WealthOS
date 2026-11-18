"use client";

import { useSession, signOut } from "next-auth/react";
import { Bell, LogOut, User, Globe } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { usePathname } from "next/navigation";

const sectionLabels: Record<string, TranslationKey> = {
  "": "nav.dashboard",
  properties: "nav.properties",
  tenants: "nav.tenants",
  documents: "nav.documents",
  expenses: "nav.expenses",
  works: "nav.works",
  tasks: "nav.tasks",
  contractors: "nav.contractors",
  investments: "nav.investments",
  comptabilite: "nav.accounting",
  fiscalite: "nav.fiscalite",
  timeline: "nav.timeline",
  notifications: "nav.notifications",
  settings: "nav.settings",
};

export function Topbar() {
  const { data: session } = useSession();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const section = sectionLabels[pathname.split("/")[1] ?? ""];
  const name = session?.user?.name || t("topbar.investor");
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const { data: notifications } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?unreadOnly=true&limit=1");
      if (!res.ok) return { count: 0 };
      const data = await res.json();
      return { count: data.totalCount || 0 };
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <div className="text-[13px] text-slate-500 truncate">
        {section ? t(section) : ""}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => setLocale(locale === "en" ? "fr" : "en")}
          className="flex items-center gap-1.5 h-8 px-2 rounded-md hover:bg-slate-100 transition-colors text-xs text-slate-500 font-medium"
          title={locale === "en" ? "Passer en français" : "Switch to English"}
        >
          <Globe size={14} />
          {locale === "en" ? "FR" : "EN"}
        </button>

        <Link
          href="/notifications"
          aria-label={t("nav.notifications")}
          className="relative grid place-items-center w-8 h-8 rounded-md hover:bg-slate-100 transition-colors"
        >
          <Bell size={16} className="text-slate-600" />
          {notifications && notifications.count > 0 && (
            <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
              {notifications.count > 9 ? "9+" : notifications.count}
            </span>
          )}
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 h-8 pl-1 pr-2 ml-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            <span className="grid place-items-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[11px] font-semibold">
              {initials}
            </span>
            <span className="text-[13px] text-slate-700 hidden sm:inline">{name}</span>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-900">{session?.user?.name}</p>
                <p className="text-xs text-slate-500">{session?.user?.email}</p>
              </div>
              <Link
                href="/settings"
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setShowMenu(false)}
              >
                <User size={14} />
                {t("topbar.settings")}
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
              >
                <LogOut size={14} />
                {t("topbar.signOut")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
