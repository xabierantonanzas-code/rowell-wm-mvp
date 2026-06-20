"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PeriodReturn } from "@/lib/returns";

const METRICS = [
  { key: "simple", label: "Simple", annKey: "simpleAnn" },
  { key: "mwr", label: "MWR", annKey: "mwrAnn" },
  { key: "twr", label: "TWR", annKey: "twrAnn" },
] as const;

const PERIOD_LABEL: Record<string, string> = {
  YTD: "YTD",
  "1A": "1 año",
  "3A": "3 años",
  "5A": "5 años",
  SI: "Desde inicio",
};

/**
 * Barras de rentabilidad por periodo (FRM-014). Interactivo: selector de
 * métrica (Simple/MWR/TWR) + toggle acumulada/anualizada.
 */
export default function PeriodReturnsChart({ data }: { data: PeriodReturn[] }) {
  const [metric, setMetric] = useState<"simple" | "mwr" | "twr">("mwr");
  const [annualized, setAnnualized] = useState(false);

  if (!data || data.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-gray-400">
        Datos insuficientes para la rentabilidad por periodo.
      </p>
    );
  }

  const m = METRICS.find((x) => x.key === metric)!;
  const valueKey = annualized ? m.annKey : m.key;
  const chartData = data.map((d) => {
    const v = (d as unknown as Record<string, number | null>)[valueKey];
    return { period: PERIOD_LABEL[d.period] ?? d.period, value: v != null ? v * 100 : null };
  });

  return (
    <div className="px-2 pb-3 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2">
        <div className="flex flex-wrap gap-2">
          {METRICS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setMetric(x.key)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                metric === x.key
                  ? "border-[var(--color-gold)] bg-[var(--color-gold)] text-white"
                  : "border-gray-300 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setAnnualized((v) => !v)}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
            annualized
              ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
              : "border-gray-300 text-gray-500 hover:bg-gray-100"
          }`}
          title="Anualizada solo para periodos de 1 año o más"
        >
          Anualizada
        </button>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#6B7280" }} />
            <YAxis
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              width={44}
            />
            <ReferenceLine y={0} stroke="#D1D5DB" />
            <Tooltip
              formatter={(v: number) => [`${v >= 0 ? "+" : ""}${v.toFixed(2)}%`, m.label + (annualized ? " anual" : "")]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.value != null && d.value < 0 ? "#DC2626" : "#16A34A"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {annualized && (
        <p className="px-3 pt-1 text-[10px] text-gray-400">
          La anualizada solo aplica a periodos de 1 año o más (YTD aparece vacío si es menor).
        </p>
      )}
    </div>
  );
}
