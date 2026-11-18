"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { ArrowLeft, ArrowRight, BookOpen, Building2, CalendarClock, Check, Loader2, TrendingUp } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const MODULES = ["EXPENSES", "WORKS", "UTILITIES", "LEGAL"] as const;
type Module = (typeof MODULES)[number];
const RECOMMENDED: Module[] = ["EXPENSES"];

const FEATURES: { icon: typeof Building2; title: TranslationKey; text: TranslationKey }[] = [
  { icon: Building2, title: "onboarding.f1Title", text: "onboarding.f1Text" },
  { icon: CalendarClock, title: "onboarding.f2Title", text: "onboarding.f2Text" },
  { icon: BookOpen, title: "onboarding.f3Title", text: "onboarding.f3Text" },
  { icon: TrendingUp, title: "onboarding.f4Title", text: "onboarding.f4Text" },
];

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${checked ? "bg-blue-700" : "bg-slate-300"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : ""}`}
      />
    </button>
  );
}

export default function WelcomePage() {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<Set<Module>>(new Set(RECOMMENDED));
  const [initialised, setInitialised] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si l'utilisateur revoit la présentation, on part de ses modules actuels
  const { data: current } = useQuery<{ module: string; isActive: boolean }[]>({
    queryKey: ["modules"],
    queryFn: () => fetch("/api/modules").then((r) => r.json()),
  });
  useEffect(() => {
    if (initialised || !Array.isArray(current)) return;
    const active = current.filter((m) => m.isActive && (MODULES as readonly string[]).includes(m.module)).map((m) => m.module as Module);
    if (active.length > 0) setSelected(new Set(active));
    setInitialised(true);
  }, [current, initialised]);

  const toggle = (m: Module) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });

  const saveModules = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules: [...selected] }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      setStep(3);
    } catch {
      setError(t("onboarding.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const firstName = session?.user?.name?.split(/\s+/)[0];

  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col">
      <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-6 h-6 rounded-[5px] bg-blue-700 text-white text-[11px] font-semibold">W</span>
          <span className="text-[15px] font-semibold text-slate-900 tracking-tight">WealthOS</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-slate-500 tabular-nums">{t("onboarding.step").replace("{n}", String(step))}</span>
          <div className="flex gap-1" aria-hidden>
            {[1, 2, 3].map((n) => (
              <span key={n} className={`h-1 w-6 rounded-full ${n <= step ? "bg-blue-700" : "bg-slate-200"}`} />
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[760px] mx-auto px-6 py-10 sm:py-14">
        {step === 1 && (
          <section className="space-y-8">
            <div className="space-y-3">
              <h1 className="text-[26px] font-semibold text-slate-900 text-balance">
                {t("onboarding.welcomeTitle")}
                {firstName ? `, ${firstName}` : ""}
              </h1>
              <p className="text-[15px] leading-relaxed text-slate-600 max-w-[60ch]">{t("onboarding.welcomeIntro")}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
              {FEATURES.map((f) => (
                <div key={f.title} className="bg-white p-5">
                  <f.icon size={18} strokeWidth={1.75} className="text-blue-700" />
                  <h2 className="mt-3 text-[14px] font-semibold text-slate-900">{t(f.title)}</h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{t(f.text)}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md bg-blue-700 text-white text-sm font-medium hover:bg-blue-800"
              >
                {t("onboarding.next")}
                <ArrowRight size={15} />
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-[26px] font-semibold text-slate-900">{t("onboarding.modulesTitle")}</h1>
              <p className="text-[15px] leading-relaxed text-slate-600 max-w-[60ch]">{t("onboarding.modulesIntro")}</p>
            </div>

            <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
              {MODULES.map((m) => (
                <li key={m}>
                  <label className="flex items-start gap-4 p-5 cursor-pointer hover:bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-slate-900">{t(`modules.${m}` as TranslationKey)}</span>
                        {RECOMMENDED.includes(m) && (
                          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                            {t("onboarding.recommended")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{t(`onboarding.mod.${m}` as TranslationKey)}</p>
                    </div>
                    <Toggle checked={selected.has(m)} onChange={() => toggle(m)} label={t(`modules.${m}` as TranslationKey)} />
                  </label>
                </li>
              ))}
            </ul>

            {error && <p className="text-[13px] text-red-600">{error}</p>}

            <div className="flex items-center justify-between">
              <button onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 h-10 px-3 text-sm text-slate-600 hover:text-slate-900">
                <ArrowLeft size={15} />
                {t("onboarding.back")}
              </button>
              <button
                onClick={saveModules}
                disabled={saving}
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 disabled:opacity-60"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {t("onboarding.next")}
                {!saving && <ArrowRight size={15} />}
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-8">
            <div className="space-y-3">
              <span className="grid place-items-center w-9 h-9 rounded-full bg-emerald-50 text-emerald-700">
                <Check size={18} />
              </span>
              <h1 className="text-[26px] font-semibold text-slate-900">{t("onboarding.readyTitle")}</h1>
              <p className="text-[15px] leading-relaxed text-slate-600 max-w-[60ch]">{t("onboarding.readyIntro")}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t("onboarding.activeModules")}</p>
              {selected.size > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {MODULES.filter((m) => selected.has(m)).map((m) => (
                    <li key={m} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-slate-100 text-[13px] text-slate-700">
                      <Check size={13} className="text-emerald-600" />
                      {t(`modules.${m}` as TranslationKey)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[13px] text-slate-500">{t("onboarding.noModules")}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/properties/new"
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md bg-blue-700 text-white text-sm font-medium hover:bg-blue-800"
              >
                {t("onboarding.addProperty")}
                <ArrowRight size={15} />
              </Link>
              <Link href="/investments" className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50">
                {t("onboarding.addInvestment")}
              </Link>
              <button onClick={() => router.push("/")} className="h-10 px-3 text-sm text-slate-600 hover:text-slate-900">
                {t("onboarding.toDashboard")}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
