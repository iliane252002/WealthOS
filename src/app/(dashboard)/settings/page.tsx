"use client";

import { useSession, signOut } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, LogOut, Globe, Package, Loader2, Check } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const ALL_MODULES = ["EXPENSES", "WORKS", "UTILITIES", "LEGAL", "ADVANCED_DOCS"] as const;

interface ModuleState {
  module: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const { t, locale, setLocale } = useI18n();
  const queryClient = useQueryClient();

  const { data: modules = [], isLoading: modulesLoading } = useQuery<ModuleState[]>({
    queryKey: ["modules"],
    queryFn: () => fetch("/api/modules").then((r) => r.json()),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ module, isActive }: { module: string; isActive: boolean }) => {
      const res = await fetch("/api/modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle module");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modules"] });
    },
  });

  const isModuleActive = (mod: string) => modules.find((m) => m.module === mod)?.isActive ?? false;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{t("settings.title")}</h1>

      {/* Profile */}
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

      {/* Language */}
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

      {/* Modules */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <Package size={18} className="text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{t("modules.title")}</h3>
        </div>
        <p className="text-sm text-slate-500 mb-5">{t("modules.subtitle")}</p>

        {modulesLoading ? (
          <div className="flex items-center gap-2 text-slate-400 py-4">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {ALL_MODULES.map((mod) => {
              const active = isModuleActive(mod);
              const nameKey = `modules.${mod}` as TranslationKey;
              const descKey = `modules.${mod}_desc` as TranslationKey;

              return (
                <div
                  key={mod}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    active ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 text-sm">{t(nameKey)}</p>
                      {active && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <Check size={10} />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{t(descKey)}</p>
                  </div>
                  <button
                    onClick={() => toggleMutation.mutate({ module: mod, isActive: !active })}
                    disabled={toggleMutation.isPending}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      active ? "bg-blue-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        active ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sign out */}
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
