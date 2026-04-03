"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTenantSchema, type CreateTenantInput } from "@/lib/validators/tenant";
import { Users, Plus, X, Mail, Phone } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  leases: Array<{
    isActive: boolean;
    monthlyRent: number;
    lot: { label: string; property: { name: string } };
  }>;
}

export default function TenantsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { t } = useI18n();

  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ["tenants"],
    queryFn: () => fetch("/api/tenants").then((r) => r.json()),
  });

  const form = useForm<CreateTenantInput>({
    resolver: zodResolver(createTenantSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateTenantInput) => {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create tenant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      setShowForm(false);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/tenants/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenants"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("tenants.title")}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? t("tenants.cancel") : t("tenants.addTenant")}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("tenants.firstName")}</label>
              <input {...form.register("firstName")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              {form.formState.errors.firstName && <p className="text-red-500 text-xs mt-1">{form.formState.errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("tenants.lastName")}</label>
              <input {...form.register("lastName")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              {form.formState.errors.lastName && <p className="text-red-500 text-xs mt-1">{form.formState.errors.lastName.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("tenants.email")}</label>
              <input {...form.register("email")} type="email" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("tenants.phone")}</label>
              <input {...form.register("phone")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("tenants.notes")}</label>
            <textarea {...form.register("notes")} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <button type="submit" disabled={createMutation.isPending} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">
            {createMutation.isPending ? t("tenants.creating") : t("tenants.createTenant")}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : !tenants || tenants.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Users size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{t("tenants.noTenants")}</h3>
          <p className="text-slate-500">{t("tenants.noTenantsDesc")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-slate-500">{t("tenants.name")}</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">{t("tenants.contact")}</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">{t("tenants.activeLease")}</th>
                <th className="text-right px-6 py-3 font-medium text-slate-500">{t("tenants.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => {
                const activeLease = tenant.leases?.find((l) => l.isActive);
                return (
                  <tr key={tenant.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {tenant.firstName} {tenant.lastName}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center gap-3">
                        {tenant.email && <span className="flex items-center gap-1"><Mail size={12} />{tenant.email}</span>}
                        {tenant.phone && <span className="flex items-center gap-1"><Phone size={12} />{tenant.phone}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {activeLease ? (
                        <span className="text-emerald-600 text-xs font-medium bg-emerald-50 px-2 py-1 rounded-full">
                          {activeLease.lot?.property?.name} - {activeLease.lot?.label}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">{t("tenants.noActiveLease")}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => deleteMutation.mutate(tenant.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
