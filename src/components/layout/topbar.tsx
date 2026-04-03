"use client";

import { useSession, signOut } from "next-auth/react";
import { Bell, LogOut, User, Globe } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";

export function Topbar() {
  const { data: session } = useSession();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t, locale, setLocale } = useI18n();

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
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div>
        <h2 className="text-sm font-medium text-slate-500">
          {t("topbar.welcome")}{" "}
          <span className="text-slate-900">{session?.user?.name || t("topbar.investor")}</span>
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setLocale(locale === "en" ? "fr" : "en")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm text-slate-600 font-medium"
          title={locale === "en" ? "Passer en français" : "Switch to English"}
        >
          <Globe size={16} />
          {locale === "en" ? "FR" : "EN"}
        </button>

        <Link
          href="/notifications"
          className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Bell size={20} className="text-slate-600" />
          {notifications && notifications.count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {notifications.count > 9 ? "9+" : notifications.count}
            </span>
          )}
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User size={16} className="text-white" />
            </div>
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
