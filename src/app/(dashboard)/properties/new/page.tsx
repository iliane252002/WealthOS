"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPropertySchema, type CreatePropertyInput, propertyTypes, ownershipTypes } from "@/lib/validators/property";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export default function NewPropertyPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [showMore, setShowMore] = useState(false);
  const { t } = useI18n();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreatePropertyInput>({
    resolver: zodResolver(createPropertySchema),
    defaultValues: {
      country: "France",
      ownershipType: "personal",
    },
  });

  const ownershipType = useWatch({ control, name: "ownershipType" });

  const mutation = useMutation({
    mutationFn: async (data: CreatePropertyInput) => {
      // Clean NaN values from optional number fields (empty inputs → NaN with valueAsNumber)
      const cleaned = { ...data };
      if (cleaned.acquisitionPrice !== undefined && isNaN(cleaned.acquisitionPrice)) delete cleaned.acquisitionPrice;
      if (cleaned.currentValue !== undefined && isNaN(cleaned.currentValue)) delete cleaned.currentValue;
      if (cleaned.surface !== undefined && isNaN(cleaned.surface)) delete cleaned.surface;
      if (cleaned.ownershipType !== "sci") cleaned.sciName = undefined;

      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleaned),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create property");
      }
      return res.json();
    },
    onSuccess: (data) => {
      router.push(`/properties/${data.id}`);
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

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/properties" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft size={20} className="text-slate-600" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{t("propertyNew.title")}</h1>
      </div>

      {serverError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{serverError}</div>
      )}

      <form
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5"
      >
        {/* REQUIRED: Name + Address only */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t("propertyNew.propertyName")} *</label>
          <input
            {...register("name")}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            placeholder={t("propertyNew.namePlaceholder")}
            autoFocus
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t("propertyNew.streetAddress")} *</label>
          <input
            {...register("address")}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            placeholder={t("propertyNew.addressPlaceholder")}
          />
          {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
        </div>

        {/* Optional details — collapsed by default */}
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {showMore ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {showMore ? t("propertyNew.lessDetails") : t("propertyNew.moreDetails")}
        </button>

        {showMore && (
          <div className="space-y-4 pt-2 border-t border-slate-100">
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

            {/* SCI Name — only shown when ownershipType is "sci" */}
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
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Link
            href="/properties"
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            {t("propertyNew.cancel")}
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            {mutation.isPending ? t("propertyNew.creating") : t("propertyNew.create")}
          </button>
        </div>
      </form>
    </div>
  );
}
