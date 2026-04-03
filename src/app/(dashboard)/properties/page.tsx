"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Building2, Plus, MapPin, Home, Layers } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface Property {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  currentValue: number | null;
  acquisitionPrice: number | null;
  lots: Array<{ id: string; status: string }>;
}

export default function PropertiesPage() {
  const { t } = useI18n();

  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: () => fetch("/api/properties").then((r) => r.json()),
  });

  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/properties/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["properties"] }),
  });

  const typeLabels: Record<string, string> = {
    APARTMENT: t("properties.apartment"),
    HOUSE: t("properties.house"),
    BUILDING: t("properties.building"),
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">{t("properties.title")}</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-slate-200 rounded w-1/2 mb-6" />
              <div className="h-6 bg-slate-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const typeBadgeColors: Record<string, string> = {
    APARTMENT: "bg-blue-50 text-blue-700",
    HOUSE: "bg-emerald-50 text-emerald-700",
    BUILDING: "bg-purple-50 text-purple-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("properties.title")}</h1>
        <Link
          href="/properties/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          {t("properties.addProperty")}
        </Link>
      </div>

      {!properties || properties.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{t("properties.noProperties")}</h3>
          <p className="text-slate-500 mb-6">{t("properties.noPropertiesDesc")}</p>
          <Link
            href="/properties/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            {t("properties.addFirst")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((property) => {
            const totalLots = property.lots?.length || 0;
            const occupiedLots = property.lots?.filter((l) => l.status === "OCCUPIED").length || 0;
            const occupancy = totalLots > 0 ? Math.round((occupiedLots / totalLots) * 100) : 0;
            const grossYield =
              property.currentValue && property.acquisitionPrice
                ? ((property.currentValue - property.acquisitionPrice) / property.acquisitionPrice) * 100
                : null;

            return (
              <Link
                key={property.id}
                href={`/properties/${property.id}`}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{property.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                      <MapPin size={14} />
                      {property.city}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${typeBadgeColors[property.type] || "bg-slate-100 text-slate-600"}`}>
                    {typeLabels[property.type] || property.type}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">{t("properties.value")}</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {property.currentValue ? formatCurrency(property.currentValue) : "—"}
                    </p>
                  </div>
                  {totalLots > 0 && (
                    <div>
                      <p className="text-xs text-slate-500">{t("properties.occupancy")}</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {occupancy}% <span className="text-slate-400 font-normal">({occupiedLots}/{totalLots})</span>
                      </p>
                    </div>
                  )}
                </div>

                {grossYield !== null && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500">{t("properties.gainLoss")}</p>
                    <p className={`text-sm font-semibold ${grossYield >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatCurrency(property.currentValue! - property.acquisitionPrice!)} ({grossYield >= 0 ? "+" : ""}{grossYield.toFixed(1)}%)
                    </p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
