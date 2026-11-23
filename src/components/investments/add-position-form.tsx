"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils";
import { isoToday } from "@/components/investments/dates";
import { assetTypes } from "@/lib/validators/investment";

interface StockResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

const TYPE_MAP: Record<string, string> = {
  EQUITY: "STOCK",
  ETF: "ETF",
  MUTUALFUND: "FUND",
  CRYPTOCURRENCY: "CRYPTO",
};

const inputCls =
  "w-full h-9 px-3 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const parseNumber = (v: string) => {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * Ajout d'une position : on choisit l'actif, on indique le montant en euros et la date.
 * Le nombre de parts est calculé à partir du cours de ce jour-là.
 */
export function AddPositionForm({
  assetTypeLabel,
  onCancel,
  onCreated,
}: {
  assetTypeLabel: (type: string) => string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { t, locale } = useI18n();

  const [listed, setListed] = useState(true);
  const [stock, setStock] = useState<StockResult | null>(null);
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("SAVINGS_ACCOUNT");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(isoToday());
  const [advanced, setAdvanced] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [customPrice, setCustomPrice] = useState(false);
  const [priceCurrency, setPriceCurrency] = useState("EUR");
  const [broker, setBroker] = useState("");
  const [account, setAccount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(search, 300);
  const { data: results = [], isFetching: searching } = useQuery<StockResult[]>({
    queryKey: ["stock-search", debouncedSearch],
    queryFn: () => fetch(`/api/stocks/search?q=${encodeURIComponent(debouncedSearch)}`).then((r) => r.json()),
    enabled: listed && debouncedSearch.length >= 2,
  });

  // Aperçu : cours du jour choisi et nombre de parts correspondant
  const { data: quote, isFetching: quoting, isError: noQuote } = useQuery<{ price: number; date: string; quoteCurrency?: string }>({
    queryKey: ["stock-quote", stock?.symbol, date],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/quote?symbol=${encodeURIComponent(stock!.symbol)}&date=${date}`);
      if (!res.ok) throw new Error("no quote");
      return res.json();
    },
    enabled: listed && !!stock && /^\d{4}-\d{2}-\d{2}$/.test(date),
    retry: false,
  });

  // Même cours dans la devise de cotation (ex. USD) : sert de taux de change pour un prix saisi en devise
  const quoteCurrency = quote?.quoteCurrency && quote.quoteCurrency !== "EUR" ? quote.quoteCurrency : null;
  const { data: nativeQuote } = useQuery<{ price: number }>({
    queryKey: ["stock-quote", stock?.symbol, date, quoteCurrency],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/quote?symbol=${encodeURIComponent(stock!.symbol)}&date=${date}&currency=${quoteCurrency}`);
      if (!res.ok) throw new Error("no quote");
      return res.json();
    },
    enabled: !!stock && !!quoteCurrency,
    retry: false,
  });
  const fxToEur = quote && nativeQuote ? quote.price / nativeQuote.price : undefined;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowResults(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const amountValue = parseNumber(amount);
  const qtyValue = parseNumber(quantity);
  const priceValue = parseNumber(unitPrice);
  // Prix réellement payé (IPO, ordre à cours limité…), converti en euros si saisi en devise
  const paidPriceEur =
    customPrice && priceValue !== undefined
      ? priceCurrency === "EUR"
        ? priceValue
        : fxToEur !== undefined
          ? priceValue * fxToEur
          : undefined
      : undefined;
  const qtyUsed = advanced ? qtyValue : undefined;
  // Quantité et prix calculés côté formulaire ; sinon le serveur prend le cours de clôture du jour
  const explicit: { quantity: number; price: number } | null =
    paidPriceEur !== undefined && qtyUsed !== undefined
      ? { quantity: qtyUsed, price: paidPriceEur }
      : paidPriceEur !== undefined && amountValue !== undefined
        ? { quantity: amountValue / paidPriceEur, price: paidPriceEur }
        : qtyUsed !== undefined && amountValue !== undefined
          ? { quantity: qtyUsed, price: amountValue / qtyUsed }
          : null;
  const useQtyPrice = listed && explicit !== null;
  const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB");
  const fmtQty = (q: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: q < 1 ? 6 : 3 }).format(q);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (listed && !stock) return setError(t("investments.whichAsset"));
    if (!listed && !name.trim()) return setError(t("investments.name"));
    if (customPrice && priceValue !== undefined && paidPriceEur === undefined) return setError(t("investments.noFx"));
    if (!useQtyPrice && amountValue === undefined) return setError(t("investments.amountHint"));

    const body: Record<string, unknown> = {
      name: listed ? stock!.name : name.trim(),
      assetType: listed ? TYPE_MAP[stock!.type] || "OTHER" : assetType,
      ticker: listed ? stock!.symbol : undefined,
      purchaseDate: date,
      currency: "EUR",
      broker: broker.trim() || undefined,
      accountName: account.trim() || undefined,
    };
    if (useQtyPrice) {
      body.quantity = Number(explicit!.quantity.toFixed(8));
      body.buyPrice = Number(explicit!.price.toFixed(6));
    } else {
      body.amount = amountValue;
    }

    setPending(true);
    try {
      const res = await fetch("/api/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const fields = data.error?.fieldErrors as Record<string, string[]> | undefined;
        throw new Error(typeof data.error === "string" ? data.error : fields ? Object.values(fields).flat().join(" · ") : "Erreur");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
      {/* 1. Quel actif ? */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="pos-search" className="text-sm font-medium text-slate-700">
            {t("investments.whichAsset")}
          </label>
          <button
            type="button"
            onClick={() => {
              setListed(!listed);
              setStock(null);
              setError(null);
            }}
            className="text-[13px] text-blue-600 hover:text-blue-800"
          >
            {listed ? t("investments.notListed") : t("investments.listed")}
          </button>
        </div>

        {listed ? (
          stock ? (
            <div className="flex items-center justify-between gap-3 h-11 px-3 border border-slate-300 rounded-md bg-slate-50">
              <div className="min-w-0 truncate text-sm">
                <span className="font-medium text-slate-900">{stock.name}</span>
                <span className="ml-2 font-mono text-xs text-slate-500">{stock.symbol}</span>
                <span className="ml-2 text-xs text-slate-400">{stock.exchange}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStock(null);
                  setSearch("");
                }}
                className="text-[13px] text-blue-600 hover:text-blue-800 shrink-0"
              >
                {t("investments.change")}
              </button>
            </div>
          ) : (
            <div ref={dropdownRef} className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="pos-search"
                autoFocus
                autoComplete="off"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                className={`${inputCls} h-11 pl-9`}
                placeholder={t("investments.searchPlaceholder")}
              />
              {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
              {showResults && results.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-72 overflow-y-auto">
                  {results.map((r) => (
                    <button
                      key={r.symbol}
                      type="button"
                      onClick={() => {
                        setStock(r);
                        setShowResults(false);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-3 border-b border-slate-100 last:border-0"
                    >
                      <span className="min-w-0 truncate">
                        <span className="text-sm font-medium text-slate-900">{r.name}</span>
                        <span className="ml-2 text-xs text-slate-400">{r.exchange}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{r.symbol}</span>
                        <span className="text-xs text-slate-400">{assetTypeLabel(TYPE_MAP[r.type] || "OTHER")}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              id="pos-search"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="Livret A, Assurance-vie…"
            />
            <select id="pos-type" value={assetType} onChange={(e) => setAssetType(e.target.value)} className={inputCls}>
              {assetTypes.map((at) => (
                <option key={at} value={at}>
                  {assetTypeLabel(at)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 2. Combien, et quand ? */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="pos-amount" className="block text-sm font-medium text-slate-700 mb-1.5">
            {listed ? t("investments.amountEur") : t("investments.valueToday")}
          </label>
          <input
            id="pos-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={paidPriceEur !== undefined && qtyUsed !== undefined}
            className={`${inputCls} tabular-nums disabled:bg-slate-50 disabled:text-slate-400`}
            placeholder="5 000"
          />
          {listed && <p className="mt-1 text-xs text-slate-500">{t("investments.amountHint")}</p>}
        </div>
        <div>
          <label htmlFor="pos-date" className="block text-sm font-medium text-slate-700 mb-1.5">
            {t("investments.purchaseDate")}
          </label>
          <input
            id="pos-date"
            type="date"
            value={date}
            max={isoToday()}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputCls} tabular-nums`}
          />
        </div>
      </div>

      {/* Aperçu du calcul */}
      {/* Prix payé différent du cours de clôture */}
      {listed && stock && (
        <div>
          {!customPrice ? (
            <button
              type="button"
              onClick={() => {
                setCustomPrice(true);
                setPriceCurrency(quoteCurrency ?? "EUR");
              }}
              className="text-[13px] text-blue-600 hover:text-blue-800"
            >
              {t("investments.customPriceLink")}
            </button>
          ) : (
            <div>
              <label htmlFor="pos-price" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t("investments.paidPrice")}
              </label>
              <div className="flex gap-2 max-w-xs">
                <input
                  id="pos-price"
                  autoFocus
                  inputMode="decimal"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className={`${inputCls} tabular-nums`}
                  placeholder={nativeQuote ? String(Math.round(nativeQuote.price * 100) / 100).replace(".", ",") : ""}
                />
                <select
                  value={priceCurrency}
                  onChange={(e) => setPriceCurrency(e.target.value)}
                  aria-label={t("investments.priceCurrency")}
                  className="h-9 px-2 border border-slate-300 rounded-md bg-white text-sm"
                >
                  <option value="EUR">€</option>
                  {quoteCurrency && <option value={quoteCurrency}>{quoteCurrency}</option>}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setCustomPrice(false);
                    setUnitPrice("");
                  }}
                  className="px-2 text-[13px] text-slate-500 hover:text-slate-800 whitespace-nowrap"
                >
                  {t("investments.useClose")}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">{t("investments.paidPriceHint")}</p>
            </div>
          )}
        </div>
      )}

      {listed && stock && useQtyPrice && explicit && (
        <p className="text-[13px] text-slate-600 tabular-nums">
          {t("investments.sharesPreviewPaid")
            .replace("{qty}", fmtQty(explicit.quantity))
            .replace("{price}", formatCurrency(explicit.price))}
          {quote && (
            <span className="text-slate-500">
              {" "}
              · {t("investments.closeThatDay").replace("{price}", formatCurrency(quote.price)).replace("{date}", fmtDate(quote.date))}
            </span>
          )}
        </p>
      )}

      {listed && stock && !useQtyPrice && (
        <p className="text-[13px] text-slate-600 tabular-nums min-h-5">
          {quoting ? (
            <Loader2 size={13} className="inline animate-spin text-slate-400" />
          ) : noQuote ? (
            <span className="text-red-600">{t("investments.noQuote")}</span>
          ) : quote ? (
            amountValue !== undefined ? (
              t("investments.sharesPreview")
                .replace("{qty}", fmtQty(amountValue / quote.price))
                .replace("{price}", formatCurrency(quote.price))
                .replace("{date}", fmtDate(quote.date))
            ) : (
              `${formatCurrency(quote.price)} · ${fmtDate(quote.date)}`
            )
          ) : null}
        </p>
      )}

      {/* Options avancées */}
      <div>
        <button
          type="button"
          onClick={() => setAdvanced(!advanced)}
          className="inline-flex items-center gap-1 text-[13px] text-slate-600 hover:text-slate-900"
        >
          {advanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {t("investments.advanced")}
        </button>
        {advanced && (
          <div className="mt-3 space-y-3">
            {listed && (
              <>
                <p className="text-xs text-slate-500">{t("investments.advancedHint")}</p>
                <div className="max-w-xs">
                  <label htmlFor="pos-qty" className="block text-xs text-slate-600 mb-1">
                    {t("investments.quantity")}
                  </label>
                  <input id="pos-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${inputCls} tabular-nums`} />
                </div>
              </>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="pos-broker" className="block text-xs text-slate-600 mb-1">
                  {t("investments.broker")}
                </label>
                <input id="pos-broker" value={broker} onChange={(e) => setBroker(e.target.value)} className={inputCls} placeholder="Boursorama, Trade Republic…" />
              </div>
              <div>
                <label htmlFor="pos-account" className="block text-xs text-slate-600 mb-1">
                  {t("investments.account")}
                </label>
                <input id="pos-account" value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls} placeholder={t("investments.accountPlaceholder")} />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-[13px] text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="h-9 px-4 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm font-medium">
          {t("investments.cancel")}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 h-9 px-4 bg-blue-700 text-white rounded-md hover:bg-blue-800 disabled:opacity-60 text-sm font-medium"
        >
          {pending && <Loader2 size={14} className="animate-spin" />}
          {t("investments.create")}
        </button>
      </div>
    </form>
  );
}
