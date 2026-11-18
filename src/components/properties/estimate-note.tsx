"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils";

type Details = {
  commune?: string;
  localType?: string;
  sales?: number;
  radius?: number | null;
  period?: string;
  surface?: number;
  error?: string;
};

/**
 * Explique d'où vient la valeur estimée d'un bien, avec un bouton pour la recalculer.
 * Affiché seulement quand l'utilisateur n'a pas saisi de valeur lui-même.
 */
export function EstimateNote({
  propertyId,
  pricePerM2,
  detailsJson,
  estimatedAt,
  propertyType,
}: {
  propertyId: string;
  pricePerM2: number | null;
  detailsJson: string | null;
  estimatedAt: string | null;
  propertyType: string | null;
}) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();

  let details: Details = {};
  try {
    details = detailsJson ? JSON.parse(detailsJson) : {};
  } catch {
    details = {};
  }

  const refresh = useMutation({
    mutationFn: async () => {
      await fetch(`/api/properties/${propertyId}/estimate`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // Bien jamais estimé (créé avant cette fonction) : on lance l'estimation à l'ouverture
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!estimatedAt && !autoStarted.current) {
      autoStarted.current = true;
      refresh.mutate();
    }
  }, [estimatedAt, refresh]);

  let text: string;
  if (details.error) {
    text = details.error;
  } else if (pricePerM2 && details.sales) {
    const where = details.radius
      ? t("estimate.within").replace("{r}", String(details.radius))
      : t("estimate.inCity").replace("{city}", details.commune ?? "");
    text = t("estimate.details")
      .replace("{ppm2}", formatCurrency(pricePerM2))
      .replace("{sales}", new Intl.NumberFormat("fr-FR").format(details.sales))
      .replace("{type}", t(`estimate.type${details.localType ?? "Appartement"}` as TranslationKey))
      .replace("{where}", where)
      .replace("{period}", details.period ?? "")
      .replace("{surface}", new Intl.NumberFormat("fr-FR").format(details.surface ?? 0));
  } else {
    text = refresh.isPending ? t("estimate.refreshing") : t("estimate.none");
  }

  return (
    <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-md bg-slate-50 border border-slate-200 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1 text-[12px] leading-relaxed text-slate-600">
        <p className={details.error ? "text-amber-700" : ""}>{text}</p>
        {!details.error && propertyType === "BUILDING" && <p className="text-slate-500">{t("estimate.buildingNote")}</p>}
        {estimatedAt && (
          <p className="text-slate-400 tabular-nums">
            {new Date(estimatedAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB")}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => refresh.mutate()}
        disabled={refresh.isPending}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-60 shrink-0"
      >
        {refresh.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        {refresh.isPending ? t("estimate.refreshing") : t("estimate.refresh")}
      </button>
    </div>
  );
}
