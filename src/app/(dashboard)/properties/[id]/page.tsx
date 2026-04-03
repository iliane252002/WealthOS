"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, MapPin, Plus, Users, FileText, Wrench,
  Home, DoorOpen, Edit2, Trash2, X, Layers,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createLotSchema, type CreateLotInput } from "@/lib/validators/lot";
import { createLeaseSchema, type CreateLeaseInput } from "@/lib/validators/lease";
import { useI18n } from "@/lib/i18n";

interface PropertyDetail {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  postalCode: string;
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
  documents: Array<{ id: string; name: string; category: string }>;
  works: Array<{ id: string; title: string; status: string; cost: number | null }>;
}

type Tab = "overview" | "lots" | "documents" | "works";

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const propertyId = params.id as string;
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showLotForm, setShowLotForm] = useState(false);
  const [showLeaseForm, setShowLeaseForm] = useState<string | null>(null);
  const { t } = useI18n();

  const { data: property, isLoading } = useQuery<PropertyDetail>({
    queryKey: ["properties", propertyId],
    queryFn: () => fetch(`/api/properties/${propertyId}`).then((r) => r.json()),
  });

  const { data: tenants } = useQuery<Array<{ id: string; firstName: string; lastName: string }>>({
    queryKey: ["tenants"],
    queryFn: () => fetch("/api/tenants").then((r) => r.json()),
  });

  const lotForm = useForm<CreateLotInput>({
    resolver: zodResolver(createLotSchema),
    defaultValues: { propertyId },
  });

  const leaseForm = useForm<CreateLeaseInput>({
    resolver: zodResolver(createLeaseSchema),
    defaultValues: { paymentDayOfMonth: 1, charges: 0, notifyDaysBefore: 3 },
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

  const createLeaseMutation = useMutation({
    mutationFn: async (data: CreateLeaseInput) => {
      const res = await fetch("/api/leases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create lease");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties", propertyId] });
      setShowLeaseForm(null);
      leaseForm.reset();
    },
  });

  const deleteLotMutation = useMutation({
    mutationFn: async (lotId: string) => {
      const res = await fetch(`/api/lots/${lotId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete lot");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["properties", propertyId] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 rounded w-1/3 animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
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

  const totalLots = property.lots.length;
  const occupiedLots = property.lots.filter((l) => l.status === "OCCUPIED").length;

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: t("propertyDetail.overview"), icon: Building2 },
    { key: "lots", label: `${t("propertyDetail.lots")} (${totalLots})`, icon: Layers },
    { key: "documents", label: `${t("propertyDetail.documents")} (${property.documents.length})`, icon: FileText },
    { key: "works", label: `${t("propertyDetail.works")} (${property.works.length})`, icon: Wrench },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/properties" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft size={20} className="text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{property.name}</h1>
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <MapPin size={14} />
            {property.address}, {property.postalCode} {property.city}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">{t("propertyDetail.propertyDetails")}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500">{t("propertyDetail.type")}</span> <span className="font-medium ml-1">{property.type}</span></div>
              <div><span className="text-slate-500">{t("propertyDetail.ownership")}</span> <span className="font-medium ml-1">{property.ownershipType}</span></div>
              <div><span className="text-slate-500">{t("propertyDetail.surface")}</span> <span className="font-medium ml-1">{property.surface ? `${property.surface} m²` : "—"}</span></div>
              <div><span className="text-slate-500">{t("propertyDetail.country")}</span> <span className="font-medium ml-1">{property.country}</span></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">{t("propertyDetail.financialSummary")}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500">{t("propertyDetail.purchasePrice")}</span><p className="font-semibold text-lg">{property.acquisitionPrice ? formatCurrency(property.acquisitionPrice) : "—"}</p></div>
              <div><span className="text-slate-500">{t("propertyDetail.currentValue")}</span><p className="font-semibold text-lg">{property.currentValue ? formatCurrency(property.currentValue) : "—"}</p></div>
              <div><span className="text-slate-500">{t("propertyDetail.occupancy")}</span><p className="font-semibold">{totalLots > 0 ? `${Math.round((occupiedLots / totalLots) * 100)}%` : t("common.na")}</p></div>
              <div><span className="text-slate-500">{t("propertyDetail.lotsCount")}</span><p className="font-semibold">{occupiedLots}/{totalLots} {t("propertyDetail.occupied")}</p></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "lots" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowLotForm(!showLotForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus size={16} />
              {t("propertyDetail.addLot")}
            </button>
          </div>

          {showLotForm && (
            <form
              onSubmit={lotForm.handleSubmit((data) => createLotMutation.mutate(data))}
              className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-3"
            >
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <input {...lotForm.register("label")} placeholder={t("propertyDetail.lotLabel")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <input {...lotForm.register("surface", { valueAsNumber: true })} type="number" placeholder={t("propertyDetail.lotSurface")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <input {...lotForm.register("rooms", { valueAsNumber: true })} type="number" placeholder={t("propertyDetail.lotRooms")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={createLotMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                  {createLotMutation.isPending ? t("propertyDetail.creatingLot") : t("propertyDetail.createLot")}
                </button>
                <button type="button" onClick={() => setShowLotForm(false)} className="px-4 py-2 text-slate-600 text-sm">Cancel</button>
              </div>
            </form>
          )}

          {property.lots.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <Home size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500">{t("propertyDetail.noLots")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {property.lots.map((lot) => {
                const activeLease = lot.leases?.find((l) => l.isActive);
                return (
                  <div key={lot.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-slate-900">{lot.label}</h4>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          lot.status === "OCCUPIED" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {lot.status}
                        </span>
                        <button onClick={() => deleteLotMutation.mutate(lot.id)} className="p-1 text-slate-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-slate-500 space-y-1">
                      {lot.surface && <p>Surface: {lot.surface} m2</p>}
                      {lot.rooms && <p>Rooms: {lot.rooms}</p>}
                    </div>

                    {activeLease ? (
                      <div className="mt-3 pt-3 border-t border-slate-100 text-sm">
                        <p className="text-slate-600">
                          <Users size={14} className="inline mr-1" />
                          {activeLease.tenant.firstName} {activeLease.tenant.lastName}
                        </p>
                        <p className="font-semibold text-slate-900 mt-1">{formatCurrency(activeLease.monthlyRent)}/month</p>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        {showLeaseForm === lot.id ? (
                          <form
                            onSubmit={leaseForm.handleSubmit((data) => createLeaseMutation.mutate({ ...data, lotId: lot.id }))}
                            className="space-y-2"
                          >
                            <select {...leaseForm.register("tenantId")} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                              <option value="">{t("propertyDetail.selectTenant")}</option>
                              {tenants?.map((t) => (
                                <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                              ))}
                            </select>
                            <input {...leaseForm.register("monthlyRent", { valueAsNumber: true })} type="number" placeholder={t("propertyDetail.monthlyRent")} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                            <input {...leaseForm.register("startDate")} type="date" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                            <div className="flex gap-2">
                              <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium">{t("propertyDetail.createLease")}</button>
                              <button type="button" onClick={() => setShowLeaseForm(null)} className="text-xs text-slate-500">Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <button onClick={() => setShowLeaseForm(lot.id)} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                            <DoorOpen size={14} />
                            {t("propertyDetail.attachTenant")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {property.documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500">{t("propertyDetail.noDocuments")}</p>
              <Link href="/documents" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                {t("propertyDetail.goToDocuments")}
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {property.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-slate-400" />
                    <span className="text-sm font-medium">{doc.name}</span>
                  </div>
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{doc.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "works" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {property.works.length === 0 ? (
            <div className="text-center py-8">
              <Wrench size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500">{t("propertyDetail.noWorks")}</p>
              <Link href="/works" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                {t("propertyDetail.goToWorks")}
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {property.works.map((work) => (
                <div key={work.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium">{work.title}</span>
                  <div className="flex items-center gap-3">
                    {work.cost && <span className="text-sm text-slate-600">{formatCurrency(work.cost)}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      work.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                      work.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                      work.status === "CANCELLED" ? "bg-red-100 text-red-700" :
                      "bg-slate-200 text-slate-600"
                    }`}>{work.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
