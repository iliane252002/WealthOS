"use client";

import { useRouter, useParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPropertySchema, type CreatePropertyInput, propertyTypes, ownershipTypes } from "@/lib/validators/property";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.id as string;
  const [serverError, setServerError] = useState("");
  const { t } = useI18n();

  const { data: property, isLoading } = useQuery({
    queryKey: ["properties", propertyId],
    queryFn: () => fetch(`/api/properties/${propertyId}`).then((r) => r.json()),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreatePropertyInput>({
    resolver: zodResolver(createPropertySchema),
  });

  const ownershipType = useWatch({ control, name: "ownershipType" });

  // Pre-fill form once property data is loaded
  useEffect(() => {
    if (property && property.id) {
      reset({
        name: property.name ?? "",
        address: property.address ?? "",
        type: property.type ?? undefined,
        city: property.city ?? "",
        postalCode: property.postalCode ?? "",
        country: property.country ?? "France",
        ownershipType: property.ownershipType ?? "personal",
        sciName: property.sciName ?? "",
        acquisitionDate: property.acquisitionDate ?? "",
        acquisitionPrice: property.acquisitionPrice ?? undefined,
        currentValue: property.currentValue ?? undefined,
        surface: property.surface ?? undefined,
        description: property.description ?? "",
      });
    }
  }, [property, reset]);

  const mutation = useMutation({
    mutationFn: async (data: CreatePropertyInput) => {
      const cleaned = { ...data };
      if (cleaned.acquisitionPrice !== undefined && isNaN(cleaned.acquisitionPrice as number)) delete cleaned.acquisitionPrice;
      if (cleaned.currentValue !== undefined && isNaN(cleaned.currentValue as number)) delete cleaned.currentValue;
      if (cleaned.surface !== undefined && isNaN(cleaned.surface as number)) delete cleaned.surface;
      if (cleaned.ownershipType !== "sci") cleaned.sciName = undefined;

      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleaned),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update property");
      }
      return res.json();
    },
    onSuccess: () => {
      router.push(`/properties/${propertyId}`);
    },
    onError: (error: Error) => {
      setServerError(error.message);
    },
  });

  const typeLabels: Record<string, string> = {
    APARTMENT: t("properties.apartment"),
    HOUSE: t("properties.house"),
    BUILDING: t("properties.building"),
  };

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="h-8 bg-slate-200 rounded animate-pulse w-1/2" />
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!property || !property.id) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <p className="text-slate-500">Property not found.</p>
        <Link href="/properties" className="text-blue-600 hover:underline mt-4 inline-block">← Back</Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/properties/${propertyId}`} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft size={20} className="text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("propertyEdit.title")}</h1>
          <p className="text-sm text-slate-500">{property.name}</p>
        </div>
      </div>

      {serverError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{serverError}</div>
      )}

      <form
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5"
      >
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t("propertyNew.propertyName")} *</label>
          <input
            {...register("name")}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            placeholder={t("propertyNew.namePlaceholder")}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t("propertyNew.streetAddress")} *</label>
          <input
            {...register("address")}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            placeholder={t("propertyNew.addressPlaceholder")}
          />
          {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
        </div>

        <div className="space-y-4 pt-2 border-t border-slate-100">
          {/* Type + Ownership */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("propertyNew.type")}</label>
              <select
                {...register("type")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">{t("propertyNew.selectType")}</option>
                {propertyTypes.map((tp) => (
                  <option key={tp} value={tp}>{typeLabels[tp]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("propertyNew.ownership")}</label>
              <select
                {...register("ownershipType")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {ownershipTypes.map((tp) => (
                  <option key={tp} value={tp}>
                    {tp === "personal" ? t("propertyNew.personal") : t("propertyNew.sci")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SCI Name (only when ownershipType === "sci") */}
          {ownershipType === "sci" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("propertyNew.sciName")}</label>
              <input
                {...register("sciName")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder={t("propertyNew.sciNamePlaceholder")}
              />
            </div>
          )}

          {/* City + Postal */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("propertyNew.city")}</label>
              <input {...register("city")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder={t("propertyNew.cityPlaceholder")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("propertyNew.postalCode")}</label>
              <input {...register("postalCode")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder={t("propertyNew.postalCodePlaceholder")} />
            </div>
          </div>

          {/* Purchase Price + Current Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("propertyNew.purchasePrice")}</label>
              <input {...register("acquisitionPrice", { valueAsNumber: true })} type="number" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("propertyNew.currentValue")}</label>
              <input {...register("currentValue", { valueAsNumber: true })} type="number" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          {/* Surface + Acquisition Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("propertyNew.surface")}</label>
              <input {...register("surface", { valueAsNumber: true })} type="number" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("propertyNew.acquisitionDate")}</label>
              <input {...register("acquisitionDate")} type="date" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link
            href={`/properties/${propertyId}`}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            {t("propertyNew.cancel")}
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            {mutation.isPending ? t("propertyEdit.saving") : t("propertyEdit.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
