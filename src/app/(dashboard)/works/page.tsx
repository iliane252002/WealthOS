"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createWorkSchema, type CreateWorkInput, workStatuses } from "@/lib/validators/work";
import { Wrench, Plus, X, Receipt, Pencil, Trash2, Loader2 } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface Work {
  id: string;
  title: string;
  description: string | null;
  contractor: string | null;
  cost: number | null;
  status: string;
  startDate: string | null;
  isTaxDeductible: boolean;
  property: { id: string; name: string } | null;
  lot: { id: string; label: string } | null;
}

const statusColors: Record<string, string> = {
  PLANNED: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const defaultValues: CreateWorkInput = {
  title: "",
  propertyId: undefined,
  contractor: "",
  cost: undefined,
  status: "PLANNED",
  isTaxDeductible: false,
  description: "",
};

const toFormValues = (w: Work): CreateWorkInput => ({
  title: w.title,
  propertyId: w.property?.id ?? undefined,
  contractor: w.contractor ?? "",
  cost: w.cost ?? undefined,
  status: w.status as CreateWorkInput["status"],
  isTaxDeductible: w.isTaxDeductible,
  description: w.description ?? "",
});

export default function WorksPage() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const [mode, setMode] = useState<"none" | "create" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const statusLabels: Record<string, string> = {
    ALL: t("works.all"),
    PLANNED: t("works.planned"),
    IN_PROGRESS: t("works.inProgress"),
    COMPLETED: t("works.completed"),
    CANCELLED: t("works.cancelled"),
  };

  const { data: works, isLoading } = useQuery<Work[]>({
    queryKey: ["works", statusFilter],
    queryFn: () => {
      const params = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
      return fetch(`/api/works${params}`).then((r) => r.json());
    },
  });

  const { data: properties } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["properties"],
    queryFn: () => fetch("/api/properties").then((r) => r.json()),
  });

  const form = useForm<CreateWorkInput>({
    resolver: zodResolver(createWorkSchema),
    defaultValues,
  });

  useEffect(() => {
    if (mode === "edit" && editingId) {
      const item = (works || []).find((w) => w.id === editingId);
      if (item) form.reset(toFormValues(item));
    } else if (mode === "create") {
      form.reset(defaultValues);
    }
  }, [mode, editingId, works, form]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateWorkInput) => {
      const res = await fetch("/api/works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create work");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["works"] });
      setMode("none");
      form.reset(defaultValues);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateWorkInput }) => {
      const res = await fetch(`/api/works/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update work");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["works"] });
      setMode("none");
      setEditingId(null);
      form.reset(defaultValues);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/works/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["works"] }),
  });

  const onSubmit = (data: CreateWorkInput) => {
    if (mode === "edit" && editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    setMode("none");
    setEditingId(null);
    form.reset(defaultValues);
  };

  const totalCost = (works || []).reduce((sum, w) => sum + (w.cost || 0), 0);
  const taxDeductibleCost = (works || [])
    .filter((w) => w.isTaxDeductible)
    .reduce((sum, w) => sum + (w.cost || 0), 0);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isEdit = mode === "edit";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("works.title")}</h1>
        <button
          onClick={() => {
            if (mode !== "none") {
              handleCancel();
            } else {
              setMode("create");
            }
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          {mode !== "none" ? <X size={16} /> : <Plus size={16} />}
          {mode !== "none" ? t("works.cancel") : t("works.addWork")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <p className="text-sm text-slate-500">{t("works.totalCost")}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalCost)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <p className="text-sm text-slate-500 flex items-center gap-1">
            <Receipt size={14} /> {t("works.taxDeductible")}
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(taxDeductibleCost)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {["ALL", ...workStatuses].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {statusLabels[s] || s}
          </button>
        ))}
      </div>

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
              <span className="text-sm font-semibold text-blue-700">Modifier le travail</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("works.workTitle")}</label>
              <input
                {...form.register("title")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {form.formState.errors.title && (
                <p className="text-red-500 text-xs mt-1">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("works.property")}</label>
              <select
                {...form.register("propertyId")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t("works.selectProperty")}</option>
                {properties?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("works.contractor")}</label>
              <input
                {...form.register("contractor")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("works.cost")}</label>
              <input
                {...form.register("cost", { valueAsNumber: true })}
                type="number"
                step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("works.status")}</label>
              <select
                {...form.register("status")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {workStatuses.map((s) => (
                  <option key={s} value={s}>{statusLabels[s] || s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              {...form.register("isTaxDeductible")}
              type="checkbox"
              id="taxDeductible"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="taxDeductible" className="text-sm text-slate-700">
              {t("works.taxDeductibleLabel")}
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("works.description")}</label>
            <textarea
              {...form.register("description")}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              {t("works.cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  {isEdit ? t("propertyEdit.saving") : t("works.creating")}
                </span>
              ) : isEdit ? (
                t("propertyEdit.save")
              ) : (
                t("works.createWork")
              )}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
          <div className="h-32 bg-slate-200 rounded" />
        </div>
      ) : !works || works.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Wrench size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{t("works.noWorks")}</h3>
          <p className="text-slate-500">{t("works.noWorksDesc")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-slate-500">{t("works.workTitle")}</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">{t("works.property")}</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">{t("works.status")}</th>
                <th className="text-right px-6 py-3 font-medium text-slate-500">{t("works.cost")}</th>
                <th className="text-center px-6 py-3 font-medium text-slate-500">{t("works.tax")}</th>
                <th className="text-center px-6 py-3 font-medium text-slate-500">{t("works.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {works.map((work) => (
                <tr
                  key={work.id}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    editingId === work.id ? "bg-blue-50/40" : ""
                  }`}
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{work.title}</p>
                    {work.contractor && <p className="text-xs text-slate-400">{work.contractor}</p>}
                    {work.description && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{work.description}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{work.property?.name || "—"}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        statusColors[work.status] || "bg-slate-100"
                      }`}
                    >
                      {statusLabels[work.status] || work.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {work.cost ? formatCurrency(work.cost) : "—"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {work.isTaxDeductible ? (
                      <Receipt size={14} className="mx-auto text-emerald-500" />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => {
                          setEditingId(work.id);
                          setMode("edit");
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this work entry?")) deleteMutation.mutate(work.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
