"use client";

import { useSession, signOut } from "next-auth/react";
import { User, LogOut, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { t, locale, setLocale } = useI18n();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{t("settings.title")}</h1>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">{t("settings.profile")}</h3>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <User size={24} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{session?.user?.name || "—"}</p>
            <p className="text-sm text-slate-500">{session?.user?.email || "—"}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">{t("settings.language")}</h3>
        <div className="flex gap-3">
          <button
            onClick={() => setLocale("en")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
              locale === "en" ? "bg-blue-50 border-blue-300 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Globe size={16} />
            English
          </button>
          <button
            onClick={() => setLocale("fr")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
              locale === "fr" ? "bg-blue-50 border-blue-300 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Globe size={16} />
            Français
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">{t("settings.account")}</h3>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
        >
          <LogOut size={16} />
          {t("settings.signOut")}
        </button>
      </div>
    </div>
  );
}
