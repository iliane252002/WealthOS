"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, Users, FileText, Wrench, Home,
  DoorOpen, ChevronDown, ChevronRight, AlertCircle,
  DollarSign, TrendingUp, Shield, Check, Clock,
  Plus, X, Trash2, Upload, Droplets, Zap, Flame, Copy,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createLeaseSchema, type CreateLeaseInput } from "@/lib/validators/lease";
import { createExpenseSchema, type CreateExpenseInput, expenseCategories } from "@/lib/validators/expense";
import { useI18n, type TranslationKey } from "@/lib/i18n";

// ─── Types ─────────────────────────────────────────

interface LotDetail {
  id: string;
  propertyId: string;
  label: string;
  status: string;
  surface: number | null;
  rooms: number | null;
  floor: number | null;
  monthlyRent: number | null;
  property: { id: string; name: string };
  leases: Array<{
    id: string;
    isActive: boolean;
    startDate: string;
    endDate: string | null;
    monthlyRent: number;
    charges: number;
    deposit: number | null;
    paymentDayOfMonth: number;
    tenant: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null };
    rentEvents: Array<{
      id: string;
      dueDate: string;
      amount: number;
      paidAmount: number;
      status: string;
      paidDate: string | null;
    }>;
  }>;
  documents: Array<{ id: string; name: string; category: string; fileUrl: string; createdAt: string }>;
  works: Array<{ id: string; title: string; status: string; cost: number | null }>;
  expenses?: Array<{ id: string; title: string; amount: number; category: string; date: string }>;
}

// ─── Reusable Components ───────────────────────────

function Section({
  title, icon: Icon, children, defaultOpen = false, badge, action,
}: {
  title: string; icon: React.ElementType; children: React.ReactNode;
  defaultOpen?: boolean; badge?: React.ReactNode; action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(!open); }}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className="text-slate-500" />
          <span className="font-semibold text-slate-900 text-sm">{title}</span>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          {action && open && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
          {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </div>
      </div>
      {open && <div className="px-6 pb-5 border-t border-slate-100 pt-4">{children}</div>}
    </div>
  );
}

function Badge({ children, color = "slate" }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    green: "bg-emerald-50 text-emerald-600",
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[color]}`}>{children}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string }> = {
    PENDING: { color: "slate" },
    DUE: { color: "amber" },
    PAID: { color: "emerald" },
    LATE: { color: "red" },
    PARTIALLY_PAID: { color: "amber" },
  };
  const cfg = map[status] || map.PENDING;
  return <Badge color={cfg.color}>{status}</Badge>;
}

// ─── Main Page ─────────────────────────────────────

export default function LotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const propertyId = params.id as string;
  const lotId = params.lotId as string;
  const { t } = useI18n();

  const [showLeaseForm, setShowLeaseForm] = useState(false);
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [showUtilityForm, setShowUtilityForm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries ───────────────────────────────────

  const { data: lot, isLoading } = useQuery<LotDetail>({
    queryKey: ["lots", lotId],
    queryFn: () => fetch(`/api/lots/${lotId}`).then((r) => r.json()),
  });

  const { data: tenants } = useQuery<Array<{ id: string; firstName: string; lastName: string }>>({
    queryKey: ["tenants"],
    queryFn: () => fetch("/api/tenants").then((r) => r.json()),
  });

  const { data: modules } = useQuery<Array<{ module: string; isActive: boolean }>>({
    queryKey: ["modules"],
    queryFn: () => fetch("/api/modules").then((r) => r.json()),
  });

  const { data: lotExpenses = [] } = useQuery<Array<{ id: string; title: string; amount: number; category: string; date: string }>>({
    queryKey: ["expenses", "lot", lotId],
    queryFn: () => fetch(`/api/expenses?lotId=${lotId}`).then((r) => r.json()),
    enabled: modules?.some((m) => m.module === "EXPENSES" && m.isActive) ?? false,
  });

  const { data: lotCompliance = [] } = useQuery<Array<{ id: string; label: string; status: string; expiryDate: string | null }>>({
    queryKey: ["compliance", "lot", lotId],
    queryFn: () => fetch(`/api/compliance?lotId=${lotId}`).then((r) => r.json()),
    enabled: modules?.some((m) => m.module === "LEGAL" && m.isActive) ?? false,
  });

  interface UtilityReading {
    id: string;
    type: string;
    period: string;
    consumption: number | null;
    cost: number | null;
    unit: string | null;
  }

  const { data: lotUtilities = [] } = useQuery<UtilityReading[]>({
    queryKey: ["utilities", "lot", lotId],
    queryFn: () => fetch(`/api/utilities?lotId=${lotId}`).then((r) => r.json()),
    enabled: modules?.some((m) => m.module === "UTILITIES" && m.isActive) ?? false,
  });

  const isModuleActive = (mod: string) => modules?.some((m) => m.module === mod && m.isActive) ?? false;

  // ─── Auto-detect late rents on page load ──────
  useEffect(() => {
    fetch("/api/rent-events/detect-late", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.updated > 0) {
          queryClient.invalidateQueries({ queryKey: ["lots", lotId] });
        }
      })
      .catch(() => {});
  }, [lotId, queryClient]);

  // ─── Forms ─────────────────────────────────────

  const leaseForm = useForm<CreateLeaseInput>({
    resolver: zodResolver(createLeaseSchema),
    defaultValues: { lotId, paymentDayOfMonth: 1, charges: 0, notifyDaysBefore: 3 },
  });

  const chargeForm = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: { lotId, category: "OTHER", isRecurring: false, date: new Date().toISOString().split("T")[0] },
  });

  // ─── Mutations ─────────────────────────────────

  const createLeaseMutation = useMutation({
    mutationFn: async (data: CreateLeaseInput) => {
      const res = await fetch("/api/leases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lots", lotId] });
      queryClient.invalidateQueries({ queryKey: ["properties", propertyId] });
      setShowLeaseForm(false);
      leaseForm.reset({ lotId, paymentDayOfMonth: 1, charges: 0, notifyDaysBefore: 3 });
    },
  });

  const endLeaseMutation = useMutation({
    mutationFn: async (leaseId: string) => {
      const res = await fetch(`/api/leases/${leaseId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to end lease");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lots", lotId] });
      queryClient.invalidateQueries({ queryKey: ["properties", propertyId] });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const res = await fetch(`/api/rent-events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidAmount: amount, paidDate: new Date().toISOString().split("T")[0] }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lots", lotId] }),
  });

  const createChargeMutation = useMutation({
    mutationFn: async (data: CreateExpenseInput) => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", "lot", lotId] });
      setShowChargeForm(false);
      chargeForm.reset({ lotId, category: "OTHER", isRecurring: false, date: new Date().toISOString().split("T")[0] });
    },
  });

  const markUnpaidMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await fetch(`/api/rent-events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidAmount: 0, paidDate: null, status: "PENDING" }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lots", lotId] }),
  });

  const markAllPaidMutation = useMutation({
    mutationFn: async (events: Array<{ id: string; amount: number }>) => {
      await Promise.all(
        events.map((e) =>
          fetch(`/api/rent-events/${e.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paidAmount: e.amount, paidDate: new Date().toISOString().split("T")[0] }),
          })
        )
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lots", lotId] }),
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadingFile(true);
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploaded = await uploadRes.json();

      const docRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploaded.name,
          category: "OTHER",
          fileUrl: uploaded.url,
          fileType: uploaded.type,
          fileSize: uploaded.size,
          propertyId,
          lotId,
        }),
      });
      if (!docRes.ok) throw new Error("Failed to save document");
      return docRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lots", lotId] });
      setUploadingFile(false);
      setShowDocUpload(false);
    },
    onError: () => setUploadingFile(false),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lots", lotId] }),
  });

  const handleFileDrop = useCallback((files: FileList | null) => {
    if (files && files.length > 0) {
      uploadDocumentMutation.mutate(files[0]);
    }
    setIsDragging(false);
  }, [uploadDocumentMutation]);

  const deleteChargeMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses", "lot", lotId] }),
  });

  const createUtilityMutation = useMutation({
    mutationFn: async (data: { type: string; period: string; consumption: number | null; cost: number | null; unit: string }) => {
      const res = await fetch("/api/utilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotId, ...data }),
      });
      if (!res.ok) throw new Error("Failed to create reading");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utilities", "lot", lotId] });
      setShowUtilityForm(false);
    },
  });

  const carryForwardUtility = useCallback((utilType: string) => {
    const lastReading = lotUtilities
      .filter((u) => u.type === utilType)
      .sort((a, b) => b.period.localeCompare(a.period))[0];

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    createUtilityMutation.mutate({
      type: utilType,
      period: currentPeriod,
      consumption: lastReading?.consumption ?? null,
      cost: lastReading?.cost ?? null,
      unit: lastReading?.unit || (utilType === "WATER" ? "m³" : utilType === "ELECTRICITY" ? "kWh" : utilType === "GAS" ? "m³" : ""),
    });
  }, [lotUtilities, createUtilityMutation]);

  // ─── Loading / Not found ───────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div className="h-8 bg-slate-200 rounded w-1/3 animate-pulse" />
        <div className="h-48 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Lot not found</p>
        <Link href={`/properties/${propertyId}`} className="text-blue-600 hover:underline mt-2 inline-block">
          {t("lotDetail.backToProperty")}
        </Link>
      </div>
    );
  }

  const activeLease = lot.leases?.find((l) => l.isActive);
  const rentEvents = activeLease?.rentEvents?.sort((a, b) => b.dueDate.localeCompare(a.dueDate)) || [];
  const totalReceived = rentEvents.reduce((s, r) => s + r.paidAmount, 0);
  const totalExpected = rentEvents.reduce((s, r) => s + r.amount, 0);
  const totalOutstanding = totalExpected - totalReceived;
  const collectionRate = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/properties/${propertyId}`} className="p-2 rounded-lg hover:bg-slate-100 transition-colors mt-0.5">
          <ArrowLeft size={20} className="text-slate-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href={`/properties/${propertyId}`} className="hover:text-blue-600">{lot.property.name}</Link>
            <span>/</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{lot.label}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Badge color={lot.status === "OCCUPIED" ? "emerald" : "slate"}>
            {lot.status === "OCCUPIED" ? t("lotDetail.occupied") : t("lotDetail.vacant")}
          </Badge>
          {activeLease && (
            <Badge color="blue">{formatCurrency(activeLease.monthlyRent)}/mo</Badge>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {/* 1. General Information */}
        <Section title={t("lotDetail.generalInfo")} icon={Home} defaultOpen>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500">{t("lotDetail.surface")}</span>
              <p className="font-medium text-slate-900 mt-0.5">{lot.surface ? `${lot.surface} m²` : "—"}</p>
            </div>
            <div>
              <span className="text-slate-500">{t("lotDetail.rooms")}</span>
              <p className="font-medium text-slate-900 mt-0.5">{lot.rooms ?? "—"}</p>
            </div>
            <div>
              <span className="text-slate-500">{t("lotDetail.floor")}</span>
              <p className="font-medium text-slate-900 mt-0.5">{lot.floor ?? "—"}</p>
            </div>
            <div>
              <span className="text-slate-500">{t("lotDetail.status")}</span>
              <p className="mt-0.5"><Badge color={lot.status === "OCCUPIED" ? "emerald" : "slate"}>{lot.status}</Badge></p>
            </div>
          </div>
        </Section>

        {/* 2. Rental & Tenant */}
        <Section title={t("lotDetail.rental")} icon={Users} defaultOpen>
          {activeLease ? (
            <div className="space-y-4">
              {/* Tenant info */}
              <div className="bg-blue-50 rounded-lg border border-blue-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-500 uppercase font-semibold mb-1">{t("lotDetail.tenant")}</p>
                    <p className="font-bold text-slate-900 text-lg">{activeLease.tenant.firstName} {activeLease.tenant.lastName}</p>
                    <div className="text-sm text-slate-600 mt-1 space-y-0.5">
                      {activeLease.tenant.email && <p>{activeLease.tenant.email}</p>}
                      {activeLease.tenant.phone && <p>{activeLease.tenant.phone}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => { if (confirm("End this lease?")) endLeaseMutation.mutate(activeLease.id); }}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    {t("lotDetail.endLease")}
                  </button>
                </div>
              </div>
              {/* Lease details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">{t("lotDetail.rentAmount")}</span>
                  <p className="font-bold text-emerald-600 text-lg mt-0.5">{formatCurrency(activeLease.monthlyRent)}</p>
                </div>
                <div>
                  <span className="text-slate-500">{t("lotDetail.chargesAmount")}</span>
                  <p className="font-medium text-slate-900 mt-0.5">{formatCurrency(activeLease.charges)}</p>
                </div>
                <div>
                  <span className="text-slate-500">{t("lotDetail.depositAmount")}</span>
                  <p className="font-medium text-slate-900 mt-0.5">{activeLease.deposit ? formatCurrency(activeLease.deposit) : "—"}</p>
                </div>
                <div>
                  <span className="text-slate-500">{t("lotDetail.since")}</span>
                  <p className="font-medium text-slate-900 mt-0.5">{activeLease.startDate}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              {showLeaseForm ? (
                <form
                  onSubmit={leaseForm.handleSubmit((data) => createLeaseMutation.mutate(data))}
                  className="text-left bg-blue-50 rounded-xl border border-blue-200 p-5 space-y-4 max-w-lg mx-auto"
                >
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <DoorOpen size={16} />
                    {t("lotDetail.createLease")}
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t("lotDetail.tenant")} *</label>
                    {tenants && tenants.length > 0 ? (
                      <select
                        {...leaseForm.register("tenantId")}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">{t("lotDetail.selectTenant")}</option>
                        {tenants.map((tn) => (
                          <option key={tn.id} value={tn.id}>{tn.firstName} {tn.lastName}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-slate-500">
                        {t("lotDetail.createTenantFirst")} <Link href="/tenants" className="text-blue-600 hover:underline">→</Link>
                      </p>
                    )}
                    {leaseForm.formState.errors.tenantId && <p className="text-red-500 text-xs mt-1">Required</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t("lotDetail.monthlyRent")} *</label>
                      <input
                        {...leaseForm.register("monthlyRent", { valueAsNumber: true })}
                        type="number" step="0.01" placeholder="850"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {leaseForm.formState.errors.monthlyRent && <p className="text-red-500 text-xs mt-1">Required</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t("lotDetail.charges")}</label>
                      <input
                        {...leaseForm.register("charges", { valueAsNumber: true })}
                        type="number" step="0.01" placeholder="50"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t("lotDetail.startDate")} *</label>
                      <input
                        {...leaseForm.register("startDate")}
                        type="date"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {leaseForm.formState.errors.startDate && <p className="text-red-500 text-xs mt-1">Required</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t("lotDetail.endDate")}</label>
                      <input
                        {...leaseForm.register("endDate")}
                        type="date"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t("lotDetail.deposit")}</label>
                      <input
                        {...leaseForm.register("deposit", { valueAsNumber: true })}
                        type="number" step="0.01" placeholder="850"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t("lotDetail.paymentDay")}</label>
                      <input
                        {...leaseForm.register("paymentDayOfMonth", { valueAsNumber: true })}
                        type="number" min="1" max="28" placeholder="1"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {createLeaseMutation.isError && (
                    <p className="text-red-500 text-sm">{(createLeaseMutation.error as Error).message}</p>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setShowLeaseForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                      {t("common.cancel")}
                    </button>
                    <button
                      type="submit" disabled={createLeaseMutation.isPending}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                    >
                      {createLeaseMutation.isPending ? t("lotDetail.creating") : t("lotDetail.createLease")}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <DoorOpen size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-500 text-sm mb-3">{t("lotDetail.noLease")}</p>
                  <button
                    onClick={() => setShowLeaseForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium inline-flex items-center gap-2"
                  >
                    <Plus size={14} />
                    {t("lotDetail.createLease")}
                  </button>
                </>
              )}
            </div>
          )}
        </Section>

        {/* 3. Rent Tracking */}
        {activeLease && (
          <Section
            title={t("lotDetail.rentTracking")}
            icon={Clock}
            defaultOpen
            badge={
              rentEvents.filter((r) => r.status === "LATE").length > 0
                ? <Badge color="red">{rentEvents.filter((r) => r.status === "LATE").length} late</Badge>
                : undefined
            }
            action={
              rentEvents.some((r) => r.status !== "PAID") ? (
                <button
                  onClick={() => {
                    const unpaid = rentEvents.filter((r) => r.status !== "PAID").map((r) => ({ id: r.id, amount: r.amount }));
                    markAllPaidMutation.mutate(unpaid);
                  }}
                  disabled={markAllPaidMutation.isPending}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  <Check size={12} />
                  {t("lotDetail.markAllPaid")}
                </button>
              ) : undefined
            }
          >
            {rentEvents.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">{t("lotDetail.noRentEvents")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100">
                      <th className="pb-2 font-medium">{t("lotDetail.month")}</th>
                      <th className="pb-2 font-medium">{t("lotDetail.amount")}</th>
                      <th className="pb-2 font-medium">{t("lotDetail.paid")}</th>
                      <th className="pb-2 font-medium">{t("lotDetail.status")}</th>
                      <th className="pb-2 font-medium text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rentEvents.map((event) => (
                      <tr key={event.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2.5 font-medium text-slate-900">{event.dueDate}</td>
                        <td className="py-2.5 text-slate-700">{formatCurrency(event.amount)}</td>
                        <td className="py-2.5 text-slate-700">{formatCurrency(event.paidAmount)}</td>
                        <td className="py-2.5">
                          <StatusBadge status={event.status} />
                        </td>
                        <td className="py-2.5 text-right">
                          {event.status !== "PAID" ? (
                            <button
                              onClick={() => markPaidMutation.mutate({ id: event.id, amount: event.amount })}
                              disabled={markPaidMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                            >
                              <Check size={12} />
                              {t("lotDetail.markPaid")}
                            </button>
                          ) : (
                            <button
                              onClick={() => markUnpaidMutation.mutate({ id: event.id })}
                              disabled={markUnpaidMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                              <X size={12} />
                              {t("lotDetail.markUnpaid")}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {/* 4. Documents */}
        <Section
          title={t("lotDetail.documents")}
          icon={FileText}
          badge={lot.documents.length > 0 ? <Badge>{lot.documents.length}</Badge> : undefined}
          action={
            <button
              onClick={() => setShowDocUpload(!showDocUpload)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
            >
              <Upload size={12} />
              {t("lotDetail.uploadDocument")}
            </button>
          }
        >
          {/* Drag & Drop Upload Zone */}
          {showDocUpload && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); handleFileDrop(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`mb-4 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-300 hover:border-blue-300 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx"
                onChange={(e) => handleFileDrop(e.target.files)}
              />
              {uploadingFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-blue-600 font-medium">{t("lotDetail.uploading")}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={28} className={isDragging ? "text-blue-400" : "text-slate-300"} />
                  <p className="text-sm text-slate-600">{t("lotDetail.dragDropHere")}</p>
                  <p className="text-xs text-slate-400">{t("lotDetail.maxFileSize")}</p>
                </div>
              )}
            </div>
          )}

          {lot.documents.length === 0 && !showDocUpload ? (
            <div className="text-center py-4">
              <FileText size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 text-sm">{t("lotDetail.noDocuments")}</p>
              <button
                onClick={() => setShowDocUpload(true)}
                className="text-xs text-blue-600 hover:underline mt-1 inline-block"
              >
                {t("lotDetail.uploadDocument")}
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {lot.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm group">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-slate-400" />
                    <span className="font-medium">{doc.name}</span>
                    <Badge>{doc.category}</Badge>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {doc.fileUrl && doc.fileUrl !== "/uploads/placeholder" && (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t("lotDetail.viewFile")}
                      </a>
                    )}
                    <button
                      onClick={() => { if (confirm("Delete?")) deleteDocMutation.mutate(doc.id); }}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 5. Charges & Expenses (lot-centric) */}
        {isModuleActive("EXPENSES") && (
          <Section
            title={t("lotDetail.charges_section")}
            icon={DollarSign}
            badge={lotExpenses.length > 0 ? <Badge>{lotExpenses.length}</Badge> : undefined}
          >
            {showChargeForm ? (
              <form
                onSubmit={chargeForm.handleSubmit((data) => createChargeMutation.mutate(data))}
                className="bg-blue-50 rounded-lg border border-blue-200 p-4 space-y-3 mb-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                    <input {...chargeForm.register("title")} placeholder="e.g. Building insurance" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Amount *</label>
                    <input {...chargeForm.register("amount", { valueAsNumber: true })} type="number" step="0.01" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                    <select {...chargeForm.register("category")} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                      {expenseCategories.map((cat) => (
                        <option key={cat} value={cat}>{t(`expenses.${cat}` as TranslationKey)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
                    <input {...chargeForm.register("date")} type="date" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={createChargeMutation.isPending} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium">
                    {createChargeMutation.isPending ? "..." : t("lotDetail.addCharge")}
                  </button>
                  <button type="button" onClick={() => setShowChargeForm(false)} className="text-xs text-slate-500">{t("common.cancel")}</button>
                </div>
              </form>
            ) : (
              <div className="flex justify-end mb-3">
                <button onClick={() => setShowChargeForm(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium">
                  <Plus size={12} />
                  {t("lotDetail.addCharge")}
                </button>
              </div>
            )}

            {lotExpenses.length === 0 && !showChargeForm ? (
              <p className="text-sm text-slate-500 text-center py-2">{t("lotDetail.noCharges")}</p>
            ) : (
              <div className="space-y-1">
                {lotExpenses.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{exp.title}</span>
                      <Badge>{t(`expenses.${exp.category}` as TranslationKey)}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{exp.date}</span>
                      <span className="font-semibold">{formatCurrency(exp.amount)}</span>
                      <button
                        onClick={() => { if (confirm("Delete?")) deleteChargeMutation.mutate(exp.id); }}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* 6. Works */}
        {isModuleActive("WORKS") && (
          <Section title={t("lotDetail.works")} icon={Wrench} badge={lot.works.length > 0 ? <Badge>{lot.works.length}</Badge> : undefined}>
            {lot.works.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-slate-500 text-sm">{t("lotDetail.noWorks")}</p>
                <Link href="/works" className="text-xs text-blue-600 hover:underline mt-1 inline-block">{t("propertyDetail.goToWorks")}</Link>
              </div>
            ) : (
              <div className="space-y-1">
                {lot.works.map((work) => (
                  <div key={work.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                    <span className="font-medium">{work.title}</span>
                    <div className="flex items-center gap-2">
                      <Badge color={work.status === "COMPLETED" ? "emerald" : work.status === "IN_PROGRESS" ? "blue" : "slate"}>{work.status}</Badge>
                      {work.cost && <span className="font-semibold">{formatCurrency(work.cost)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* 7. Utilities — Water, Electricity, Gas */}
        {isModuleActive("UTILITIES") && (
          <Section
            title={t("lotDetail.utilities")}
            icon={Droplets}
            badge={lotUtilities.length > 0 ? <Badge>{lotUtilities.length}</Badge> : undefined}
            action={
              <button
                onClick={() => setShowUtilityForm(!showUtilityForm)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
              >
                <Plus size={12} />
                {t("lotDetail.addReading")}
              </button>
            }
          >
            {/* Add Reading Form */}
            {showUtilityForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const consumption = fd.get("consumption") as string;
                  const cost = fd.get("cost") as string;
                  createUtilityMutation.mutate({
                    type: fd.get("type") as string,
                    period: fd.get("period") as string,
                    consumption: consumption ? parseFloat(consumption) : null,
                    cost: cost ? parseFloat(cost) : null,
                    unit: fd.get("type") === "WATER" ? "m³" : fd.get("type") === "GAS" ? "m³" : "kWh",
                  });
                }}
                className="bg-blue-50 rounded-lg border border-blue-200 p-4 space-y-3 mb-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t("lotDetail.utilityType")} *</label>
                    <select name="type" required className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                      <option value="WATER">💧 {t("lotDetail.water")}</option>
                      <option value="ELECTRICITY">⚡ {t("lotDetail.electricity")}</option>
                      <option value="GAS">🔥 {t("lotDetail.gas")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t("lotDetail.period")} *</label>
                    <input
                      name="period"
                      type="month"
                      required
                      defaultValue={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t("lotDetail.consumption")}</label>
                    <input name="consumption" type="number" step="0.01" placeholder="ex: 12.5" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t("lotDetail.utilityCost")}</label>
                    <input name="cost" type="number" step="0.01" placeholder="ex: 45.00" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={createUtilityMutation.isPending} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium">
                    {createUtilityMutation.isPending ? "..." : t("lotDetail.addReading")}
                  </button>
                  <button type="button" onClick={() => setShowUtilityForm(false)} className="text-xs text-slate-500">{t("common.cancel")}</button>
                </div>
              </form>
            )}

            {lotUtilities.length === 0 && !showUtilityForm ? (
              <div className="text-center py-4">
                <Droplets size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-slate-500 text-sm">{t("lotDetail.noReadings")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Group by type */}
                {(["WATER", "ELECTRICITY", "GAS"] as const).map((utilType) => {
                  const readings = lotUtilities
                    .filter((u) => u.type === utilType)
                    .sort((a, b) => b.period.localeCompare(a.period));
                  if (readings.length === 0) return null;

                  const icon = utilType === "WATER" ? <Droplets size={14} className="text-blue-400" /> :
                               utilType === "ELECTRICITY" ? <Zap size={14} className="text-amber-400" /> :
                               <Flame size={14} className="text-orange-400" />;
                  const label = utilType === "WATER" ? t("lotDetail.water") :
                                utilType === "ELECTRICITY" ? t("lotDetail.electricity") :
                                t("lotDetail.gas");

                  return (
                    <div key={utilType}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {icon}
                          <span className="text-sm font-semibold text-slate-700">{label}</span>
                        </div>
                        <button
                          onClick={() => carryForwardUtility(utilType)}
                          disabled={createUtilityMutation.isPending}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title={t("lotDetail.keepSameLevel")}
                        >
                          <Copy size={12} />
                          {t("lotDetail.keepSameLevel")}
                        </button>
                      </div>
                      <div className="space-y-1">
                        {readings.slice(0, 6).map((r) => (
                          <div key={r.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                            <span className="text-slate-600 font-medium">{r.period}</span>
                            <div className="flex items-center gap-3">
                              {r.consumption !== null && (
                                <span className="text-slate-700">{r.consumption} {r.unit}</span>
                              )}
                              {r.cost !== null && (
                                <span className="font-semibold text-slate-900">{formatCurrency(r.cost)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* 8. Legal & Compliance */}
        {isModuleActive("LEGAL") && (
          <Section title={t("lotDetail.legal")} icon={Shield}>
            {lotCompliance.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">{t("compliance.noItems")}</p>
            ) : (
              <div className="space-y-1">
                {lotCompliance.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                    <span className="font-medium">{item.label}</span>
                    <Badge color={item.status === "OK" ? "emerald" : item.status === "MISSING" ? "red" : "amber"}>{item.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* 8. Financial Overview */}
        {activeLease && rentEvents.length > 0 && (
          <Section title={t("lotDetail.financialView")} icon={TrendingUp}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-500">{t("lotDetail.totalReceived")}</span>
                <p className="text-lg font-bold text-emerald-600 mt-0.5">{formatCurrency(totalReceived)}</p>
              </div>
              <div>
                <span className="text-slate-500">{t("lotDetail.totalExpected")}</span>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{formatCurrency(totalExpected)}</p>
              </div>
              <div>
                <span className="text-slate-500">{t("lotDetail.outstanding")}</span>
                <p className={`text-lg font-bold mt-0.5 ${totalOutstanding > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatCurrency(totalOutstanding)}
                </p>
              </div>
              <div>
                <span className="text-slate-500">{t("lotDetail.collectionRate")}</span>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{collectionRate}%</p>
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
