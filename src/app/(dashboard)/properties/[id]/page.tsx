"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Building2, MapPin, Plus, Users, FileText, Wrench,
  Home, DoorOpen, Trash2, Layers, ChevronDown, ChevronRight,
  AlertCircle, Zap, Droplets, Shield, DollarSign, TrendingUp,
  Upload, Eye, X, Pencil,
} from "lucide-react";
import Link from "next/link";
import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createLotSchema, type CreateLotInput } from "@/lib/validators/lot";
import { useI18n } from "@/lib/i18n";

interface PropertyDetail {
  id: string;
  name: string;
  type: string | null;
  address: string;
  city: string | null;
  postalCode: string | null;
  country: string;
  ownershipType: string;
  acquisitionDate: string | null;
  acquisitionPrice: number | null;
  currentValue: number | null;
  surface: number | null;
  lots: Array<{
    id: string;
    label: string;
    status: string;
    surface: number | null;
    rooms: number | null;
    floor: number | null;
    leases: Array<{
      id: string;
      isActive: boolean;
      monthlyRent: number;
      tenant: { id: string; firstName: string; lastName: string };
    }>;
  }>;
  documents: Array<{ id: string; name: string; category: string; fileUrl: string }>;
  works: Array<{ id: string; title: string; status: string; cost: number | null }>;
}

// ─── Expandable Section ─────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  action?: React.ReactNode;
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
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[color]}`}>{children}</span>;
}

// ─── Smart Guidance ─────────────────────────────────

function SmartGuidance({ property }: { property: PropertyDetail }) {
  const { t } = useI18n();
  const hints: { text: string; link?: string }[] = [];

  if (!property.type) hints.push({ text: t("guidance.noType"), link: `/properties/${property.id}/edit` });
  if (!property.currentValue) hints.push({ text: t("guidance.noValue"), link: `/properties/${property.id}/edit` });
  if (!property.lots || property.lots.length === 0) hints.push({ text: t("guidance.noLots") });

  (property.lots || []).forEach((lot) => {
    const activeLease = lot.leases?.find((l) => l.isActive);
    if (!activeLease && lot.status === "VACANT") {
      hints.push({ text: `${lot.label}: ${t("guidance.noTenant")}` });
    }
  });

  if (!property.documents || property.documents.length === 0) hints.push({ text: t("guidance.noDocuments") });

  if (hints.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle size={16} className="text-amber-600" />
        <span className="text-sm font-semibold text-amber-800">{t("guidance.title")}</span>
      </div>
      <ul className="space-y-1">
        {hints.map((hint, i) => (
          <li key={i} className="text-sm text-amber-700 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0" />
            {hint.link ? (
              <Link href={hint.link} className="underline hover:text-amber-900">{hint.text} →</Link>
            ) : hint.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────

export default function PropertyDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const propertyId = params.id as string;
  const [showLotForm, setShowLotForm] = useState(false);
  const { t } = useI18n();

  const { data: property, isLoading } = useQuery<PropertyDetail>({
    queryKey: ["properties", propertyId],
    queryFn: () => fetch(`/api/properties/${propertyId}`).then((r) => r.json()),
  });

  const { data: modules } = useQuery<Array<{ module: string; isActive: boolean }>>({
    queryKey: ["modules"],
    queryFn: () => fetch("/api/modules").then((r) => r.json()),
  });

  const { data: expenses } = useQuery({
    queryKey: ["expenses", propertyId],
    queryFn: () => fetch(`/api/expenses?propertyId=${propertyId}`).then((r) => r.json()),
    enabled: modules?.some((m) => m.module === "EXPENSES" && m.isActive) ?? false,
  });

  const { data: complianceItems } = useQuery({
    queryKey: ["compliance", propertyId],
    queryFn: () => fetch(`/api/compliance?propertyId=${propertyId}`).then((r) => r.json()),
    enabled: modules?.some((m) => m.module === "LEGAL" && m.isActive) ?? false,
  });

  const isModuleActive = (mod: string) => modules?.some((m) => m.module === mod && m.isActive) ?? false;

  const lotForm = useForm<CreateLotInput>({
    resolver: zodResolver(createLotSchema),
    defaultValues: { propertyId },
  });

  const createLotMutation = useMutation({
    mutationFn: async (data: CreateLotInput) => {
      const res = await fetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create lot");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties", propertyId] });
      setShowLotForm(false);
      lotForm.reset({ propertyId });
    },
  });

  const deleteLotMutation = useMutation({
    mutationFn: async (lotId: string) => {
      const res = await fetch(`/api/lots/${lotId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete lot");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["properties", propertyId] }),
  });

  // Document upload
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadDocMutation = useMutation({
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
        }),
      });
      if (!docRes.ok) throw new Error("Failed to save document");
      return docRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties", propertyId] });
      setUploadingFile(false);
      setShowDocUpload(false);
    },
    onError: () => setUploadingFile(false),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["properties", propertyId] }),
  });

  const handleFileDrop = useCallback((files: FileList | null) => {
    if (files && files.length > 0) {
      uploadDocMutation.mutate(files[0]);
    }
    setIsDragging(false);
  }, [uploadDocMutation]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/3 animate-pulse" />
        <div className="h-48 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">{t("propertyDetail.notFound")}</p>
        <Link href="/properties" className="text-blue-600 hover:underline mt-2 inline-block">
          {t("propertyDetail.backToProperties")}
        </Link>
      </div>
    );
  }

  const lots = property.lots || [];
  const documents = property.documents || [];
  const works = property.works || [];
  const totalLots = lots.length;
  const occupiedLots = lots.filter((l) => l.status === "OCCUPIED").length;
  const totalMonthlyRent = lots.reduce((sum, lot) => {
    const activeLease = lot.leases?.find((l) => l.isActive);
    return sum + (activeLease?.monthlyRent || 0);
  }, 0);

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/properties" className="p-2 rounded-lg hover:bg-slate-100 transition-colors mt-0.5">
          <ArrowLeft size={20} className="text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{property.name}</h1>
          <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
            <MapPin size={14} />
            {property.address}{property.city ? `, ${property.postalCode || ""} ${property.city}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {property.type && <Badge color="blue">{property.type}</Badge>}
          {totalLots > 0 && (
            <Badge color={occupiedLots === totalLots ? "emerald" : "amber"}>
              {occupiedLots}/{totalLots} {t("propertyDetail.occupied")}
            </Badge>
          )}
          {totalMonthlyRent > 0 && (
            <Badge color="emerald">{formatCurrency(totalMonthlyRent)}/mo</Badge>
          )}
          <Link
            href={`/properties/${propertyId}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Pencil size={14} />
            {t("propertyDetail.edit")}
          </Link>
        </div>
      </div>

      {/* Smart Guidance */}
      <SmartGuidance property={property} />

      {/* Sections */}
      <div className="space-y-3">
        {/* 1. General Information */}
        <Section title={t("propertyDetail.generalInfo")} icon={Building2} defaultOpen>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500">{t("propertyDetail.type")}</span>
              <p className="font-medium text-slate-900 mt-0.5">{property.type || "—"}</p>
            </div>
            <div>
              <span className="text-slate-500">{t("propertyDetail.ownership")}</span>
              <p className="font-medium text-slate-900 mt-0.5">{property.ownershipType}</p>
            </div>
            <div>
              <span className="text-slate-500">{t("propertyDetail.surface")}</span>
              <p className="font-medium text-slate-900 mt-0.5">{property.surface ? `${property.surface} m²` : "—"}</p>
            </div>
            <div>
              <span className="text-slate-500">{t("propertyDetail.country")}</span>
              <p className="font-medium text-slate-900 mt-0.5">{property.country}</p>
            </div>
          </div>
          {(property.acquisitionPrice || property.currentValue) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4 pt-4 border-t border-slate-100">
              <div>
                <span className="text-slate-500">{t("propertyDetail.purchasePrice")}</span>
                <p className="font-semibold text-slate-900 mt-0.5">{property.acquisitionPrice ? formatCurrency(property.acquisitionPrice) : "—"}</p>
              </div>
              <div>
                <span className="text-slate-500">{t("propertyDetail.currentValue")}</span>
                <p className="font-semibold text-slate-900 mt-0.5">{property.currentValue ? formatCurrency(property.currentValue) : "—"}</p>
              </div>
              {property.acquisitionPrice && property.currentValue && (
                <div>
                  <span className="text-slate-500">{t("properties.gainLoss")}</span>
                  <p className={`font-semibold mt-0.5 ${property.currentValue >= property.acquisitionPrice ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(property.currentValue - property.acquisitionPrice)}
                  </p>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 2. Lots & Tenants */}
        <Section
          title={`${t("propertyDetail.lots")} & ${t("propertyDetail.rental")}`}
          icon={Layers}
          defaultOpen
          badge={totalLots > 0 ? <Badge>{totalLots}</Badge> : undefined}
        >
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => setShowLotForm(!showLotForm)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
              >
                <Plus size={14} />
                {t("propertyDetail.addLot")}
              </button>
            </div>

            {showLotForm && (
              <form
                onSubmit={lotForm.handleSubmit((data) => createLotMutation.mutate(data))}
                className="bg-blue-50 rounded-lg border border-blue-200 p-3 space-y-2"
              >
                <div className="grid grid-cols-3 gap-2">
                  <input {...lotForm.register("label")} placeholder={t("propertyDetail.lotLabel")} className="px-2 py-1.5 border border-slate-300 rounded text-sm" />
                  <input {...lotForm.register("surface", { valueAsNumber: true })} type="number" placeholder={t("propertyDetail.lotSurface")} className="px-2 py-1.5 border border-slate-300 rounded text-sm" />
                  <input {...lotForm.register("rooms", { valueAsNumber: true })} type="number" placeholder={t("propertyDetail.lotRooms")} className="px-2 py-1.5 border border-slate-300 rounded text-sm" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={createLotMutation.isPending} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium">
                    {createLotMutation.isPending ? t("propertyDetail.creatingLot") : t("propertyDetail.createLot")}
                  </button>
                  <button type="button" onClick={() => setShowLotForm(false)} className="text-xs text-slate-500">{t("common.cancel")}</button>
                </div>
              </form>
            )}

            {lots.length === 0 ? (
              <div className="text-center py-6">
                <Home size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-slate-500 text-sm">{t("propertyDetail.noLots")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lots.map((lot) => {
                  const activeLease = lot.leases?.find((l) => l.isActive);
                  return (
                    <Link
                      key={lot.id}
                      href={`/properties/${propertyId}/lots/${lot.id}`}
                      className="bg-slate-50 rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:shadow-md transition-all group block"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-slate-900 text-sm group-hover:text-blue-600">{lot.label}</h4>
                        <div className="flex items-center gap-2">
                          <Badge color={lot.status === "OCCUPIED" ? "emerald" : "slate"}>{lot.status}</Badge>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteLotMutation.mutate(lot.id); }}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 space-y-0.5">
                        {lot.surface && <p>{lot.surface} m²</p>}
                        {lot.rooms && <p>{lot.rooms} {t("propertyDetail.lotRooms")}</p>}
                      </div>

                      {activeLease ? (
                        <div className="mt-2 pt-2 border-t border-slate-200 text-sm">
                          <p className="text-slate-600 flex items-center gap-1">
                            <Users size={12} />
                            {activeLease.tenant.firstName} {activeLease.tenant.lastName}
                          </p>
                          <p className="font-semibold text-emerald-600">{formatCurrency(activeLease.monthlyRent)}/mo</p>
                        </div>
                      ) : (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <span className="text-xs text-blue-600 flex items-center gap-1">
                            <DoorOpen size={12} />
                            {t("propertyDetail.attachTenant")}
                          </span>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </Section>

        {/* 3. Documents */}
        <Section
          title={t("propertyDetail.documents")}
          icon={FileText}
          badge={documents.length > 0 ? <Badge>{documents.length}</Badge> : undefined}
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
                isDragging ? "border-blue-400 bg-blue-50" : "border-slate-300 hover:border-blue-300 hover:bg-slate-50"
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

          {documents.length === 0 && !showDocUpload ? (
            <div className="text-center py-4">
              <FileText size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 text-sm">{t("propertyDetail.noDocuments")}</p>
              <button onClick={() => setShowDocUpload(true)} className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                {t("lotDetail.uploadDocument")}
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm group">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-slate-400" />
                    <span className="font-medium">{doc.name}</span>
                    <Badge>{doc.category}</Badge>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {doc.fileUrl && doc.fileUrl !== "/uploads/placeholder" && (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-500 hover:bg-blue-50 rounded">
                        <Eye size={14} />
                      </a>
                    )}
                    <button onClick={() => { if (confirm("Delete?")) deleteDocMutation.mutate(doc.id); }} className="p-1 text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 4. Expenses (if module active) */}
        {isModuleActive("EXPENSES") && (
          <Section title={t("propertyDetail.expenses")} icon={DollarSign}>
            {!expenses || expenses.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-slate-500 text-sm">{t("expenses.noExpenses")}</p>
                <Link href="/expenses" className="text-xs text-blue-600 hover:underline mt-1 inline-block">{t("expenses.addExpense")}</Link>
              </div>
            ) : (
              <div className="space-y-1">
                {expenses.slice(0, 5).map((exp: { id: string; title: string; amount: number; category: string; date: string }) => (
                  <div key={exp.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                    <span className="font-medium">{exp.title}</span>
                    <div className="flex items-center gap-2">
                      <Badge>{exp.category}</Badge>
                      <span className="font-semibold">{formatCurrency(exp.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* 5. Works (if module active) */}
        {isModuleActive("WORKS") && (
          <Section
            title={t("propertyDetail.works")}
            icon={Wrench}
            badge={works.length > 0 ? <Badge>{works.length}</Badge> : undefined}
          >
            {works.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-slate-500 text-sm">{t("propertyDetail.noWorks")}</p>
                <Link href="/works" className="text-xs text-blue-600 hover:underline mt-1 inline-block">{t("propertyDetail.goToWorks")}</Link>
              </div>
            ) : (
              <div className="space-y-1">
                {works.map((work) => (
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

        {/* 6. Legal & Compliance (if module active) */}
        {isModuleActive("LEGAL") && (
          <Section title={t("propertyDetail.legal")} icon={Shield}>
            {!complianceItems || complianceItems.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-slate-500 text-sm">{t("compliance.noItems")}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {complianceItems.map((item: { id: string; label: string; status: string; expiryDate: string | null }) => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                    <span className="font-medium">{item.label}</span>
                    <Badge color={item.status === "OK" ? "emerald" : item.status === "MISSING" ? "red" : item.status === "EXPIRED" ? "red" : "amber"}>
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* 7. Financial Overview */}
        {totalLots > 0 && (
          <Section title={t("propertyDetail.financialView")} icon={TrendingUp}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-500">{t("dashboard.totalRentReceived")}</span>
                <p className="text-lg font-bold text-emerald-600 mt-0.5">{formatCurrency(totalMonthlyRent)}<span className="text-xs text-slate-400 font-normal">/mo</span></p>
              </div>
              <div>
                <span className="text-slate-500">{t("propertyDetail.occupancy")}</span>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{totalLots > 0 ? `${Math.round((occupiedLots / totalLots) * 100)}%` : t("common.na")}</p>
              </div>
              {property.currentValue && (
                <div>
                  <span className="text-slate-500">{t("propertyDetail.currentValue")}</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{formatCurrency(property.currentValue)}</p>
                </div>
              )}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
