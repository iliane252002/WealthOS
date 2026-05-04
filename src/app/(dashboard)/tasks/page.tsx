"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  ChevronRight,
  Loader2,
  ClipboardList,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: string | null;
  createdAt: string;
  property: { id: string; name: string } | null;
  lot: { id: string; label: string } | null;
  tenant: { id: string; firstName: string; lastName: string } | null;
  contractor: { id: string; name: string; trade: string } | null;
}

interface TaskFormValues {
  title: string;
  description: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: string;
  propertyId: string;
  contractorId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  LOW: "Faible",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};

const PRIORITY_COLORS: Record<Task["priority"], string> = {
  LOW: "bg-slate-100 text-slate-600",
  NORMAL: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700",
};

const STATUS_NEXT: Record<Task["status"], Task["status"] | null> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: null,
};

const COLUMNS: Array<{
  status: Task["status"];
  label: string;
  headerClass: string;
  countClass: string;
}> = [
  {
    status: "TODO",
    label: "À faire",
    headerClass: "bg-slate-100 text-slate-700",
    countClass: "bg-slate-200 text-slate-600",
  },
  {
    status: "IN_PROGRESS",
    label: "En cours",
    headerClass: "bg-blue-100 text-blue-700",
    countClass: "bg-blue-200 text-blue-700",
  },
  {
    status: "DONE",
    label: "Terminées",
    headerClass: "bg-emerald-100 text-emerald-700",
    countClass: "bg-emerald-200 text-emerald-700",
  },
];

const defaultValues: TaskFormValues = {
  title: "",
  description: "",
  priority: "NORMAL",
  status: "TODO",
  dueDate: "",
  propertyId: "",
  contractorId: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === "DONE") return false;
  return new Date(task.dueDate) < new Date(new Date().toDateString());
}

function formatDueDate(dueDate: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dueDate));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"none" | "create" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | Task["status"]>("ALL");

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => fetch("/api/tasks").then((r) => r.json()),
  });

  const { data: properties = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["properties"],
    queryFn: () => fetch("/api/properties").then((r) => r.json()),
  });

  const { data: contractors = [] } = useQuery<Array<{ id: string; name: string; trade: string }>>({
    queryKey: ["contractors"],
    queryFn: () => fetch("/api/contractors").then((r) => r.json()),
  });

  // ── Form ───────────────────────────────────────────────────────────────────

  const form = useForm<TaskFormValues>({ defaultValues });

  useEffect(() => {
    if (mode === "edit" && editingId) {
      const item = tasks.find((t) => t.id === editingId);
      if (item) {
        form.reset({
          title: item.title,
          description: item.description ?? "",
          priority: item.priority,
          status: item.status,
          dueDate: item.dueDate ? item.dueDate.split("T")[0] : "",
          propertyId: item.property?.id ?? "",
          contractorId: item.contractor?.id ?? "",
        });
      }
    } else if (mode === "create") {
      form.reset(defaultValues);
    }
  }, [mode, editingId, tasks, form]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: TaskFormValues) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          propertyId: data.propertyId || undefined,
          contractorId: data.contractorId || undefined,
          dueDate: data.dueDate || undefined,
        }),
      });
      if (!res.ok) throw new Error("Échec de la création");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setMode("none");
      form.reset(defaultValues);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskFormValues> & { status?: Task["status"] } }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          propertyId: data.propertyId || undefined,
          contractorId: data.contractorId || undefined,
          dueDate: data.dueDate || undefined,
        }),
      });
      if (!res.ok) throw new Error("Échec de la mise à jour");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setMode("none");
      setEditingId(null);
      form.reset(defaultValues);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Échec de la suppression");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const onSubmit = (data: TaskFormValues) => {
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

  const handleMoveNext = (task: Task) => {
    const next = STATUS_NEXT[task.status];
    if (!next) return;
    updateMutation.mutate({ id: task.id, data: { status: next } });
  };

  const handleEdit = (task: Task) => {
    setEditingId(task.id);
    setMode("edit");
  };

  const handleDelete = (id: string) => {
    if (confirm("Supprimer cette tâche ?")) deleteMutation.mutate(id);
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isEdit = mode === "edit";
  const today = new Date(new Date().toDateString());

  const filteredTasks =
    statusFilter === "ALL" ? tasks : tasks.filter((t) => t.status === statusFilter);

  const countTodo = tasks.filter((t) => t.status === "TODO").length;
  const countInProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const countDone = tasks.filter((t) => t.status === "DONE").length;
  const countOverdue = tasks.filter(
    (t) => t.dueDate && t.status !== "DONE" && new Date(t.dueDate) < today
  ).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Tâches</h1>
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
          {mode !== "none" ? "Annuler" : "Nouvelle tâche"}
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
          <span className="text-2xl font-bold text-slate-900">{countTodo}</span>
          <span className="text-sm text-slate-500">à faire</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
          <span className="text-2xl font-bold text-blue-600">{countInProgress}</span>
          <span className="text-sm text-slate-500">en cours</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
          <span className="text-2xl font-bold text-emerald-600">{countDone}</span>
          <span className="text-sm text-slate-500">terminées</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
          <span className="text-2xl font-bold text-red-600">{countOverdue}</span>
          <span className="text-sm text-slate-500">en retard</span>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(["ALL", "TODO", "IN_PROGRESS", "DONE"] as const).map((s) => {
          const labels: Record<string, string> = {
            ALL: "Toutes",
            TODO: "À faire",
            IN_PROGRESS: "En cours",
            DONE: "Terminées",
          };
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {labels[s]}
            </button>
          );
        })}
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
              <span className="text-sm font-semibold text-blue-700">Modifier la tâche</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Titre <span className="text-red-500">*</span>
              </label>
              <input
                {...form.register("title", { required: true })}
                autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Titre de la tâche"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priorité</label>
              <select
                {...form.register("priority")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(["LOW", "NORMAL", "HIGH", "URGENT"] as const).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Échéance</label>
              <input
                {...form.register("dueDate")}
                type="date"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bien</label>
              <select
                {...form.register("propertyId")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Aucun —</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Artisan</label>
              <select
                {...form.register("contractorId")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Aucun —</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.trade})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
              <select
                {...form.register("status")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="TODO">À faire</option>
                <option value="IN_PROGRESS">En cours</option>
                <option value="DONE">Terminée</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              {...form.register("description")}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Détails optionnels..."
            />
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
                "Créer la tâche"
              )}
            </button>
          </div>
        </form>
      )}

      {/* Kanban columns */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse space-y-3">
              <div className="h-5 bg-slate-200 rounded w-1/3" />
              <div className="h-20 bg-slate-100 rounded" />
              <div className="h-20 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Aucune tâche</h3>
          <p className="text-slate-500">Créez votre première tâche pour commencer à organiser votre travail.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            // Tasks in this column after applying the status filter pill
            const displayTasks =
              statusFilter !== "ALL" && statusFilter !== col.status
                ? []
                : filteredTasks.filter((t) => t.status === col.status);

            // Always show the true count (not affected by filter)
            const colCount = tasks.filter((t) => t.status === col.status).length;

            return (
              <div key={col.status} className="flex flex-col gap-3">
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${col.headerClass}`}>
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${col.countClass}`}>
                    {colCount}
                  </span>
                </div>

                {/* Task cards */}
                {displayTasks.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center text-sm text-slate-400">
                    Aucune tâche
                  </div>
                ) : (
                  displayTasks.map((task) => {
                    const overdue = isOverdue(task);
                    const isBeingEdited = editingId === task.id && mode === "edit";

                    return (
                      <div
                        key={task.id}
                        className={`bg-white rounded-xl border shadow-sm p-4 space-y-2.5 transition-colors ${
                          isBeingEdited ? "border-blue-300 bg-blue-50/30" : "border-slate-200"
                        }`}
                      >
                        {/* Title + priority */}
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-slate-900 text-sm leading-snug">{task.title}</p>
                          <span
                            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}
                          >
                            {PRIORITY_LABEL[task.priority]}
                          </span>
                        </div>

                        {/* Description */}
                        {task.description && (
                          <p className="text-xs text-slate-500 line-clamp-2">{task.description}</p>
                        )}

                        {/* Due date */}
                        {task.dueDate && (
                          <p
                            className={`text-xs flex items-center gap-1 ${
                              overdue ? "text-red-600 font-medium" : "text-slate-500"
                            }`}
                          >
                            {overdue ? "⚠ En retard · " : "Échéance : "}
                            {formatDueDate(task.dueDate)}
                          </p>
                        )}

                        {/* Links */}
                        <div className="flex flex-wrap gap-1.5">
                          {task.property && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {task.property.name}
                            </span>
                          )}
                          {task.lot && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {task.lot.label}
                            </span>
                          )}
                          {task.contractor && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {task.contractor.name}
                            </span>
                          )}
                          {task.tenant && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {task.tenant.firstName} {task.tenant.lastName}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-100">
                          {STATUS_NEXT[task.status] && (
                            <button
                              onClick={() => handleMoveNext(task)}
                              disabled={updateMutation.isPending}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Passer à l'étape suivante"
                            >
                              <ChevronRight size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(task)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(task.id)}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
