"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ReturnsPoint } from "@/lib/returns";

const METRICS = [
  { key: "simple", label: "Simple", color: "#9CA3AF" },
  { key: "mwr", label: "MWR", color: "#3D4F63" },
  { key: "twr", label: "TWR", color: "#B8965A" },
] as const;

/**
 * Gráfico interactivo de rentabilidad acumulada en el tiempo (Simple/MWR/TWR).
 * - Tooltip al pasar el ratón con las 3 métricas a esa fecha.
 * - Chips para encender/apagar cada línea.
 */
export default function ReturnsChart({ data }: { data: ReturnsPoint[] }) {
  const [visible, setVisible] = useState<Record<string, boolean>>({
    simple: true,
    mwr: true,
    twr: true,
  });

  if (!data || data.length < 2) {
    return (
      <p className="px-5 py-8 text-center text-sm text-gray-400">
        Datos insuficientes para el gráfico de rentabilidad (hacen falta al menos 2 snapshots).
      </p>
    );
  }

  const chartData = data.map((d) => ({
    date: d.date,
    simple: d.simple != null ? d.simple * 100 : null,
    mwr: d.mwr != null ? d.mwr * 100 : null,
    twr: d.twr != null ? d.twr * 100 : null,
  }));

  const fmtDate = (s: string) => {
    const parts = s.split("-");
    return parts.length === 3 ? `${parts[1]}/${parts[0].slice(2)}` : s;
  };

  return (
    <div className="px-2 pb-3 pt-1">
      <div className="flex flex-wrap gap-2 px-3 pb-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setVisible((v) => ({ ...v, [m.key]: !v[m.key] }))}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              visible[m.key]
                ? "border-gray-300 text-[var(--color-primary)]"
                : "border-gray-200 text-gray-300"
            }`}
            aria-pressed={visible[m.key]}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: visible[m.key] ? m.color : "#D1D5DB" }}
            />
            {m.label}
          </button>
        ))}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              minTickGap={32}
            />
            <YAxis
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              width={44}
            />
            <Tooltip
              formatter={(v: number, name: string) => [
                `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
                name,
              ]}
              labelFormatter={(l) => `Fecha: ${l}`}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
            />
            {METRICS.filter((m) => visible[m.key]).map((m) => (
              <Line
                key={m.key}
                type="monotone"
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                dot={false}
                strokeWidth={2}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
