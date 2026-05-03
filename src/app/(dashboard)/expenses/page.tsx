"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createExpenseSchema, type CreateExpenseInput, expenseCategories, expenseFrequencies } from "@/lib/validators/expense";
import {
  Receipt,
  Plus,
  X,
  Trash2,
  ArrowUpDown,
  Filter,
  Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  isRecurring: boolean;
  frequency: string | null;
  date: string;
  notes: string | null;
  propertyId: string | null;
  property?: { id: string; name: string } | null;
}

interface Property {
  id: string;
  name: string;
}

export default function ExpensesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterProperty, setFilterProperty] = useState<string>("ALL");

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["expenses", filterCategory, filterProperty],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterCategory !== "ALL") params.set("category", filterCategory);
      if (filterProperty !== "ALL") params.set("propertyId", filterProperty);
      return fetch(`/api/expenses?${params}`).then((r) => r.json());
    },
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: () => fetch("/api/properties").then((r) => r.json()),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      isRecurring: false,
      category: "OTHER",
      date: new Date().toISOString().split("T")[0],
    },
  });

  const isRecurring = watch("isRecurring");

  const createMutation = useMutation({
    mutationFn: async (data: CreateExpenseInput) => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create expense");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setShowForm(false);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete expense");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const recurringExpenses = expenses.filter((e) => e.isRecurring);
  const oneTimeExpenses = expenses.filter((e) => !e.isRecurring);
  const recurringTotal = recurringExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("expenses.title")}</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? t("expenses.cancel") : t("expenses.addExpense")}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm text-slate-500">{t("expenses.totalExpenses")}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm text-slate-500">{t("expenses.recurring")}</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(recurringTotal)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{recurringExpenses.length} items</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm text-slate-500">{t("expenses.oneTime")}</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalExpenses - recurringTotal)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{oneTimeExpenses.length} items</p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("expenses.expenseTitle")} *</label>
              <input
                {...register("title")}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="e.g. Building insurance"
                autoFocus
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("expenses.amount")} *</label>
              <input
                {...register("amount", { valueAsNumber: true })}
                type="number"
                step="0.01"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="0.00"
              />
              {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("expenses.category")}</label>
              <select
                {...register("category")}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {expenseCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`expenses.${cat}` as TranslationKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("expenses.date")} *</label>
              <input
                {...register("date")}
                type="date"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("expenses.property")}</label>
              <select
                {...register("propertyId")}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">{t("expenses.none")}</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                {...register("isRecurring")}
                type="checkbox"
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-slate-700">{t("expenses.isRecurring")}</span>
            </label>
            {isRecurring && (
              <div>
                <select
                  {...register("frequency")}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {expenseFrequencies.map((freq) => (
                    <option key={freq} value={freq}>
                      {t(`expenses.${freq}` as TranslationKey)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              {...register("notes")}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); reset(); }}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              {t("expenses.cancel")}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {createMutation.isPending ? t("expenses.creating") : t("expenses.createExpense")}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter size={16} className="text-slate-400" />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">{t("expenses.category")}: All</option>
          {expenseCategories.map((cat) => (
            <option key={cat} value={cat}>
              {t(`expenses.${cat}` as TranslationKey)}
            </option>
          ))}
        </select>
        <select
          value={filterProperty}
          onChange={(e) => setFilterProperty(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">{t("expenses.property")}: All</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Receipt size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-900">{t("expenses.noExpenses")}</h3>
          <p className="text-sm text-slate-500 mt-1">{t("expenses.noExpensesDesc")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 font-medium">{t("expenses.expenseTitle")}</th>
                <th className="px-4 py-3 font-medium">{t("expenses.category")}</th>
                <th className="px-4 py-3 font-medium">{t("expenses.property")}</th>
                <th className="px-4 py-3 font-medium">{t("expenses.date")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("expenses.amount")}</th>
                <th className="px-4 py-3 font-medium text-center">{t("expenses.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium text-slate-900">{expense.title}</span>
                      {expense.isRecurring && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
                          {expense.frequency ? t(`expenses.${expense.frequency}` as TranslationKey) : t("expenses.recurring")}
                        </span>
                      )}
                    </div>
                    {expense.notes && <p className="text-xs text-slate-400 mt-0.5">{expense.notes}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {t(`expenses.${expense.category}` as TranslationKey)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{expense.property?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{expense.date}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(expense.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        if (confirm("Delete this expense?")) deleteMutation.mutate(expense.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
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
