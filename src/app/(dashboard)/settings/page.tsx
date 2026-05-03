"use client";

import { useSession, signOut } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, LogOut, Globe, Package, Loader2, Check, Landmark, RefreshCw, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const ALL_MODULES = ["EXPENSES", "WORKS", "UTILITIES", "LEGAL", "ADVANCED_DOCS"] as const;

interface ModuleState { module: string; isActive: boolean; }
interface BankConnection {
  id: string;
  institutionName: string;
  institutionId: string;
  status: string;
  lastSyncAt: string | null;
  _count: { transactions: number };
}
interface Institution { id: string; name: string; logo: string; }
interface BankTransaction {
  id: string;
  bookingDate: string;
  amount: number;
  currency: string;
  debtorName: string | null;
  remittanceInfo: string | null;
  matchStatus: string;
  connection: { institutionName: string };
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 h-32 animate-pulse" />)}</div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const { data: session } = useSession();
  const { t, locale, setLocale } = useI18n();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"general" | "banking">("general");
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankingAlert, setBankingAlert] = useState<"success" | "error" | null>(null);

  // Read ?banking=success or ?tab=banking from callback
  useEffect(() => {
    if (searchParams.get("banking") === "success") { setTab("banking"); setBankingAlert("success"); }
    if (searchParams.get("banking") === "error") { setTab("banking"); setBankingAlert("error"); }
    if (searchParams.get("tab") === "banking") setTab("banking");
  }, [searchParams]);

  // ── Modules ──
  const { data: modules = [], isLoading: modulesLoading } = useQuery<ModuleState[]>({
    queryKey: ["modules"],
    queryFn: () => fetch("/api/modules").then((r) => r.json()),
  });
  const toggleMutation = useMutation({
    mutationFn: async ({ module, isActive }: { module: string; isActive: boolean }) => {
      const res = await fetch("/api/modules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module, isActive }) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["modules"] }),
  });
  const isModuleActive = (mod: string) => modules.find((m) => m.module === mod)?.isActive ?? false;

  // ── Banking ──
  const { data: connections = [], isLoading: connectionsLoading } = useQuery<BankConnection[]>({
    queryKey: ["banking", "connections"],
    queryFn: () => fetch("/api/banking/connections").then((r) => r.json()),
    enabled: tab === "banking",
  });
  const { data: institutions = [], isLoading: institutionsLoading } = useQuery<Institution[]>({
    queryKey: ["banking", "institutions"],
    queryFn: () => fetch("/api/banking/institutions").then((r) => r.json()),
    enabled: showBankSelector,
    staleTime: 10 * 60 * 1000,
  });
  const { data: unmatchedTxs = [] } = useQuery<BankTransaction[]>({
    queryKey: ["banking", "transactions", "unmatched"],
    queryFn: () => fetch("/api/banking/transactions?matchStatus=UNMATCHED").then((r) => r.json()),
    enabled: tab === "banking",
  });

  const connectMutation = useMutation({
    mutationFn: async ({ institutionId, institutionName }: { institutionId: string; institutionName: string }) => {
      const res = await fetch("/api/banking/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId, institutionName }),
      });
      if (!res.ok) throw new Error("Failed to connect");
      return res.json();
    },
    onSuccess: (data) => { window.location.href = data.redirectUrl; },
  });

  const syncMutation = useMutation({
    mutationFn: async (connectionId?: string) => {
      const res = await fetch("/api/banking/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(connectionId ? { connectionId } : {}),
      });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banking"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const matchTxMutation = useMutation({
    mutationFn: async ({ transactionId, action }: { transactionId: string; action: "ignore" }) => {
      const res = await fetch("/api/banking/transactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, action }),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["banking", "transactions"] }),
  });

  const filteredInstitutions = institutions.filter((i) =>
    i.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{t("settings.title")}</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab("general")} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === "general" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          Général
        </button>
        <button onClick={() => setTab("banking")} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${tab === "banking" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <Landmark size={14} />
          Comptes bancaires
          {unmatchedTxs.length > 0 && <span className="bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{unmatchedTxs.length}</span>}
        </button>
      </div>

      {tab === "general" && (
        <>
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
              {(["en", "fr"] as const).map((l) => (
                <button key={l} onClick={() => setLocale(l)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${locale === l ? "bg-blue-50 border-blue-300 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  <Globe size={16} />
                  {l === "en" ? "English" : "Français"}
                </button>
              ))}
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
              <div className="flex items-center gap-2 text-slate-400 py-4"><Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading...</span></div>
            ) : (
              <div className="space-y-3">
                {ALL_MODULES.map((mod) => {
                  const active = isModuleActive(mod);
                  return (
                    <div key={mod} className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${active ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 text-sm">{t(`modules.${mod}` as TranslationKey)}</p>
                          {active && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Check size={10} />Active</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{t(`modules.${mod}_desc` as TranslationKey)}</p>
                      </div>
                      <button onClick={() => toggleMutation.mutate({ module: mod, isActive: !active })} disabled={toggleMutation.isPending} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${active ? "bg-blue-600" : "bg-slate-300"}`}>
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${active ? "translate-x-5" : "translate-x-0"}`} />
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
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium">
              <LogOut size={16} />{t("settings.signOut")}
            </button>
          </div>
        </>
      )}

      {tab === "banking" && (
        <div className="space-y-4">
          {/* Callback alerts */}
          {bankingAlert === "success" && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <p className="text-sm text-emerald-800 font-medium">Compte bancaire connecté avec succès ! Lancement de la première synchronisation...</p>
            </div>
          )}
          {bankingAlert === "error" && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={18} className="text-red-600" />
              <p className="text-sm text-red-800 font-medium">La connexion a échoué. Réessaie ou contacte le support.</p>
            </div>
          )}

          {/* Connected accounts */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Comptes connectés</h3>
              <button onClick={() => { syncMutation.mutate(undefined); }} disabled={syncMutation.isPending || connections.length === 0} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40">
                <RefreshCw size={14} className={syncMutation.isPending ? "animate-spin" : ""} />
                Synchroniser
              </button>
            </div>

            {connectionsLoading ? (
              <div className="py-6 flex justify-center"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
            ) : connections.length === 0 ? (
              <div className="text-center py-8">
                <Landmark size={32} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm mb-4">Aucun compte bancaire connecté</p>
                <p className="text-xs text-slate-400">Connecte ton compte pour que les loyers se marquent payés automatiquement à réception des virements</p>
              </div>
            ) : (
              <div className="space-y-3">
                {connections.map((conn) => (
                  <div key={conn.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                        <Landmark size={18} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{conn.institutionName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${conn.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {conn.status === "ACTIVE" ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                            {conn.status === "ACTIVE" ? "Actif" : conn.status}
                          </span>
                          <span className="text-xs text-slate-400">{conn._count.transactions} transactions</span>
                          {conn.lastSyncAt && <span className="text-xs text-slate-400">· Sync {new Date(conn.lastSyncAt).toLocaleDateString("fr-FR")}</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => syncMutation.mutate(conn.id)} disabled={syncMutation.isPending} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Synchroniser ce compte">
                      <RefreshCw size={14} className={syncMutation.isPending ? "animate-spin" : ""} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add bank button */}
            <button onClick={() => setShowBankSelector(!showBankSelector)} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg text-sm font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
              <Landmark size={16} />
              + Connecter une banque
            </button>
          </div>

          {/* Bank selector */}
          {showBankSelector && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Sélectionne ta banque</h3>
              <input
                type="text"
                placeholder="Rechercher (BNP, Société Générale, CA...)"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {institutionsLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                  {filteredInstitutions.slice(0, 30).map((inst) => (
                    <button
                      key={inst.id}
                      onClick={() => connectMutation.mutate({ institutionId: inst.id, institutionName: inst.name })}
                      disabled={connectMutation.isPending}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                    >
                      {inst.logo ? (
                        <img src={inst.logo} alt={inst.name} className="w-8 h-8 object-contain rounded" />
                      ) : (
                        <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center">
                          <Landmark size={14} className="text-slate-400" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-slate-700 truncate">{inst.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Transactions to review */}
          {unmatchedTxs.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={16} className="text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-900">Virements à vérifier ({unmatchedTxs.length})</h3>
              </div>
              <div className="space-y-2">
                {unmatchedTxs.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{tx.amount}€ — {tx.debtorName || "Expéditeur inconnu"}</p>
                      <p className="text-xs text-slate-500">{tx.bookingDate} · {tx.remittanceInfo || "Pas de référence"} · {tx.connection.institutionName}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => matchTxMutation.mutate({ transactionId: tx.id, action: "ignore" })} className="text-xs px-2 py-1 text-slate-500 hover:text-slate-700 border border-slate-200 rounded hover:bg-slate-100 transition-colors">
                        Ignorer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Comment ça marche ?</h4>
            <ol className="space-y-1.5 text-sm text-blue-800">
              <li className="flex gap-2"><span className="font-bold">1.</span> Tu connectes ton compte bancaire une seule fois (accès lecture uniquement)</li>
              <li className="flex gap-2"><span className="font-bold">2.</span> Chaque nuit, WealthOS récupère tes virements entrants</li>
              <li className="flex gap-2"><span className="font-bold">3.</span> Si le montant correspond à un loyer attendu, il est marqué <strong>Payé</strong> automatiquement</li>
              <li className="flex gap-2"><span className="font-bold">4.</span> Les virements ambigus apparaissent ici pour confirmation manuelle</li>
            </ol>
            <p className="text-xs text-blue-600 mt-3">🔒 Ton mot de passe bancaire n&apos;est jamais stocké — accès via GoCardless (agréé PSD2)</p>
          </div>
        </div>
      )}
    </div>
  );
} // end SettingsContent
