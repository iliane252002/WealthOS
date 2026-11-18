"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

// Couleurs de la charte (voir globals.css)
const ACCENT = "var(--color-blue-600)";
const ACCENT_FILL = "var(--color-blue-100)";
const MUTED = "var(--color-slate-400)";
const GRID = "var(--color-slate-100)";
const AXIS = "var(--color-slate-500)";
const UP = "var(--color-emerald-600)";
const DOWN = "var(--color-red-600)";

export type PortfolioPoint = { date: string; value: number; invested: number };
export type PricePoint = { date: string; price: number };

const dateFmt = (locale: string, opts: Intl.DateTimeFormatOptions) => (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", opts);

function axisDateFormatter(locale: string, first?: string, last?: string) {
  const days = first && last ? (new Date(last).getTime() - new Date(first).getTime()) / 86400000 : 0;
  if (days > 400) return dateFmt(locale, { month: "short", year: "numeric" });
  if (days > 60) return dateFmt(locale, { month: "short" });
  return dateFmt(locale, { day: "numeric", month: "short" });
}

function compactCurrency(value: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    notation: Math.abs(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 10000 ? 1 : 0,
  }).format(value);
}

function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-lg px-3 py-2 text-[12px] tabular-nums">{children}</div>
  );
}

export function PortfolioChart({
  points,
  locale,
  labels,
}: {
  points: PortfolioPoint[];
  locale: string;
  labels: { value: string; invested: string };
}) {
  const fmtAxis = axisDateFormatter(locale, points[0]?.date, points[points.length - 1]?.date);
  const fmtFull = dateFmt(locale, { day: "numeric", month: "long", year: "numeric" });

  return (
    <ResponsiveContainer width="100%" height={260} initialDimension={{ width: 800, height: 260 }}>
      <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="pf-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT_FILL} stopOpacity={0.9} />
            <stop offset="100%" stopColor={ACCENT_FILL} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtAxis}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={48}
        />
        <YAxis
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => compactCurrency(v)}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <Tooltip
          cursor={{ stroke: MUTED, strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as PortfolioPoint;
            return (
              <TooltipBox>
                <p className="text-slate-500 mb-1">{fmtFull(p.date)}</p>
                <p className="text-slate-900">
                  {labels.value} : <span className="font-semibold">{formatCurrency(p.value)}</span>
                </p>
                <p className="text-slate-500">
                  {labels.invested} : {formatCurrency(p.invested)}
                </p>
              </TooltipBox>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="invested"
          stroke={MUTED}
          strokeDasharray="4 4"
          strokeWidth={1.25}
          fill="none"
          dot={false}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={ACCENT}
          strokeWidth={1.75}
          fill="url(#pf-fill)"
          dot={false}
          activeDot={{ r: 3.5, fill: ACCENT, stroke: "white", strokeWidth: 1.5 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ points, up }: { points: PricePoint[]; up: boolean }) {
  if (points.length < 2) return <span className="text-slate-300">—</span>;
  return (
    <div className="w-24 h-7">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 96, height: 28 }}>
        <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="monotone" dataKey="price" stroke={up ? UP : DOWN} strokeWidth={1.25} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PositionChart({
  points,
  buyPrice,
  currency,
  locale,
  buyLabel,
}: {
  points: PricePoint[];
  buyPrice: number;
  currency: string;
  locale: string;
  buyLabel: string;
}) {
  const fmtAxis = axisDateFormatter(locale, points[0]?.date, points[points.length - 1]?.date);
  const fmtFull = dateFmt(locale, { day: "numeric", month: "long", year: "numeric" });
  const last = points[points.length - 1]?.price ?? buyPrice;
  const color = last >= buyPrice ? UP : DOWN;
  const money = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: v < 10 ? 4 : 2 }).format(v);

  return (
    <ResponsiveContainer width="100%" height={200} initialDimension={{ width: 800, height: 200 }}>
      <LineChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtAxis}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={48}
        />
        <YAxis
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => compactCurrency(v, currency)}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <ReferenceLine
          y={buyPrice}
          ifOverflow="extendDomain"
          stroke={MUTED}
          strokeDasharray="4 4"
          label={{ value: `${buyLabel} ${money(buyPrice)}`, position: "insideTopLeft", fill: AXIS, fontSize: 11 }}
        />
        <Tooltip
          cursor={{ stroke: MUTED, strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as PricePoint;
            return (
              <TooltipBox>
                <p className="text-slate-500 mb-1">{fmtFull(p.date)}</p>
                <p className="font-semibold text-slate-900">{money(p.price)}</p>
              </TooltipBox>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3.5, fill: color, stroke: "white", strokeWidth: 1.5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
