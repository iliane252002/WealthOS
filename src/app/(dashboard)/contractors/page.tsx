"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Search,
  HardHat,
  Star,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Trade =
  | "PLOMBIER"
  | "ELECTRICIEN"
  | "MACON"
  | "MENUISIER"
  | "PEINTRE"
  | "CHAUFFAGISTE"
  | "JARDINIER"
  | "SERRURIER"
  | "AUTRE";

interface Contractor {
  id: string;
  name: string;
  company: string | null;
  trade: Trade;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  rating: number | null;
  _count: { tasks: number };
}

interface ContractorFormValues {
  name: string;
  company: string;
  trade: Trade;
  phone: string;
  email: string;
  address: string;
  notes: string;
  rating: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRADE_LABEL: Record<Trade, string> = {
  PLOMBIER: "Plombier",
  ELECTRICIEN: "Électricien",
  MACON: "Maçon",
  MENUISIER: "Menuisier",
  PEINTRE: "Peintre",
  CHAUFFAGISTE: "Chauffagiste",
  JARDINIER: "Jardinier",
  SERRURIER: "Serrurier",
  AUTRE: "Autre",
};

const TRADE_COLOR: Record<Trade, string> = {
  PLOMBIER: "bg-blue-50 text-blue-700",
  ELECTRICIEN: "bg-amber-50 text-amber-700",
  MACON: "bg-slate-100 text-slate-700",
  MENUISIER: "bg-amber-50 text-amber-800",
  PEINTRE: "bg-violet-50 text-violet-600",
  CHAUFFAGISTE: "bg-red-50 text-red-700",
  JARDINIER: "bg-emerald-50 text-emerald-700",
  SERRURIER: "bg-slate-100 text-slate-700",
  AUTRE: "bg-slate-100 text-slate-600",
};

const ALL_TRADES: Trade[] = [
  "PLOMBIER",
  "ELECTRICIEN",
  "MACON",
  "MENUISIER",
  "PEINTRE",
  "CHAUFFAGISTE",
  "JARDINIER",
  "SERRURIER",
  "AUTRE",
];

const defaultValues: ContractorFormValues = {
  name: "",
  company: "",
  trade: "AUTRE",
  phone: "",
  email: "",
  address: "",
  notes: "",
  rating: null,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = hovered !== null ? n <= hovered : value !== null && n <= value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            className="p-0.5 transition-transform hover:scale-110"
            title={`${n} étoile${n > 1 ? "s" : ""}`}
          >
            <Star
              size={20}
              className={filled ? "fill-amber-400 text-amber-400" : "text-slate-300"}
            />
          </button>
        );
      })}
      {value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 text-xs text-slate-400 hover:text-slate-600"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function DisplayStars({ rating }: { rating: number | null }) {
  if (rating === null) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContractorsPage() {
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"none" | "create" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState<Trade | "ALL">("ALL");
  const [rating, setRating] = useState<number | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: contractors = [], isLoading } = useQuery<Contractor[]>({
    queryKey: ["contractors"],
    queryFn: () => fetch("/api/contractors").then((r) => r.json()),
  });

  // ── Form ───────────────────────────────────────────────────────────────────

  const form = useForm<ContractorFormValues>({ defaultValues });

  useEffect(() => {
    if (mode === "edit" && editingId) {
      const item = contractors.find((c) => c.id === editingId);
      if (item) {
        setRating(item.rating);
        form.reset({
          name: item.name,
          company: item.company ?? "",
          trade: item.trade,
          phone: item.phone ?? "",
          email: item.email ?? "",
          address: item.address ?? "",
          notes: item.notes ?? "",
          rating: item.rating,
        });
      }
    } else if (mode === "create") {
      setRating(null);
      form.reset(defaultValues);
    }
  }, [mode, editingId, contractors, form]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: ContractorFormValues) => {
      const res = await fetch("/api/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          company: data.company || undefined,
          phone: data.phone || undefined,
          email: data.email || undefined,
          address: data.address || undefined,
          notes: data.notes || undefined,
          rating: rating,
        }),
      });
      if (!res.ok) throw new Error("Échec de la création");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      setMode("none");
      setRating(null);
      form.reset(defaultValues);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ContractorFormValues }) => {
      const res = await fetch(`/api/contractors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          company: data.company || undefined,
          phone: data.phone || undefined,
          email: data.email || undefined,
          address: data.address || undefined,
          notes: data.notes || undefined,
          rating: rating,
        }),
      });
      if (!res.ok) throw new Error("Échec de la mise à jour");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      setMode("none");
      setEditingId(null);
      setRating(null);
      form.reset(defaultValues);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contractors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Échec de la suppression");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contractors"] }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const onSubmit = (data: ContractorFormValues) => {
    if (mode === "edit" && editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    setMode("none");
    setEditingId(null);
    setRating(null);
    form.reset(defaultValues);
  };

  const handleEdit = (contractor: Contractor) => {
    setEditingId(contractor.id);
    setMode("edit");
  };

  const handleDelete = (id: string) => {
    if (confirm("Supprimer cet artisan ?")) deleteMutation.mutate(id);
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isEdit = mode === "edit";

  const filtered = contractors.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      TRADE_LABEL[c.trade].toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q);
    const matchesTrade = tradeFilter === "ALL" || c.trade === tradeFilter;
    return matchesSearch && matchesTrade;
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Carnet d&apos;artisans</h1>
        <button
          onClick={() => {
            if (mode !== "none") {
              handleCancel();
            } else {
              setMode("create");
            }
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          {mode !== "none" ? <X size={16} /> : <Plus size={16} />}
          {mode !== "none" ? "Annuler" : "Ajouter un artisan"}
        </button>
      </div>

      {/* Create / Edit form */}
      {mode !== "none" && (
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={`bg-white rounded-xl shadow-sm p-6 space-y-4 border ${
            isEdit ? "border-blue-300" : "border-slate-200"
          }`}
        >
          {isEdit && (
            <div className="flex items-center gap-2 mb-1">
              <Pencil size={14} className="text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">Modifier l&apos;artisan</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                {...form.register("name", { required: true })}
                autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nom de l'artisan"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Entreprise</label>
              <input
                {...form.register("company")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nom de l'entreprise"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Corps de métier <span className="text-red-500">*</span>
              </label>
              <select
                {...form.register("trade", { required: true })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ALL_TRADES.map((t) => (
                  <option key={t} value={t}>
                    {TRADE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
              <input
                {...form.register("phone")}
                type="tel"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="06 00 00 00 00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <input
                {...form.register("email")}
                type="email"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="contact@exemple.fr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Adresse</label>
            <input
              {...form.register("address")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Adresse complète"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              {...form.register("notes")}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Commentaires, tarifs, disponibilités..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Note</label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  {isEdit ? "Enregistrement..." : "Création..."}
                </span>
              ) : isEdit ? (
                "Enregistrer"
              ) : (
                "Ajouter l'artisan"
              )}
            </button>
          </div>
        </form>
      )}

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un artisan..."
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Trade filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTradeFilter("ALL")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            tradeFilter === "ALL"
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Tous
        </button>
        {ALL_TRADES.map((t) => (
          <button
            key={t}
            onClick={() => setTradeFilter(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tradeFilter === t
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {TRADE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Grid / Loading / Empty */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse space-y-3"
            >
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-5 bg-slate-200 rounded w-2/3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 && contractors.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
          <HardHat size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Aucun artisan enregistré
          </h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            Ajoutez vos artisans de confiance pour les retrouver facilement lors de vos travaux.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Search size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">Aucun artisan ne correspond à votre recherche.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((contractor) => {
            const isBeingEdited = editingId === contractor.id && mode === "edit";
            return (
              <div
                key={contractor.id}
                className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3 transition-colors ${
                  isBeingEdited ? "border-blue-300 bg-blue-50/20" : "border-slate-200"
                }`}
              >
                {/* Trade badge */}
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TRADE_COLOR[contractor.trade]}`}
                  >
                    {TRADE_LABEL[contractor.trade]}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEdit(contractor)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Modifier"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(contractor.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Name & company */}
                <div>
                  <p className="text-lg font-bold text-slate-900 leading-tight">{contractor.name}</p>
                  {contractor.company && (
                    <p className="text-sm text-slate-500 italic mt-0.5">{contractor.company}</p>
                  )}
                </div>

                {/* Contact */}
                <div className="space-y-1">
                  {contractor.phone && (
                    <a
                      href={`tel:${contractor.phone}`}
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors"
                    >
                      <Phone size={13} className="text-slate-400 shrink-0" />
                      {contractor.phone}
                    </a>
                  )}
                  {contractor.email && (
                    <a
                      href={`mailto:${contractor.email}`}
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors truncate"
                    >
                      <Mail size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{contractor.email}</span>
                    </a>
                  )}
                </div>

                {/* Rating */}
                {contractor.rating !== null && (
                  <DisplayStars rating={contractor.rating} />
                )}

                {/* Task count */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    {contractor._count.tasks}{" "}
                    {contractor._count.tasks === 1 ? "tâche assignée" : "tâches assignées"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
