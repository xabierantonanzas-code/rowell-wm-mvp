"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ===========================================================================
// Types
// ===========================================================================

interface CombinedChartDataPoint {
  month: string;       // Label for x-axis (e.g. "ene 24")
  rawMonth: string;    // YYYY-MM for sorting
  nav: number;         // Net Asset Value (portfolio total)
  returnPct: number;   // Monthly return %
  flows: number;       // Net cash flows (aportaciones - reembolsos)
}

interface CombinedChartProps {
  data: CombinedChartDataPoint[];
  kpis: {
    valorInicio: number;
    valorFin: number;
    variacion: number;
    variacionPct: number;
    mejorMes: { month: string; pct: number } | null;
    peorMes: { month: string; pct: number } | null;
    rentabilidadPeriodo: number;
    aportacionesNetas: number;
  };
}

type ChartView = "general" | "nav" | "rentabilidad" | "aportaciones";

// ===========================================================================
// Helpers
// ===========================================================================

function formatEur(value: number): string {
  return value.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(Math.round(value));
}

// ===========================================================================
// Custom Tooltip
// ===========================================================================

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
      <p className="mb-2 text-xs font-semibold text-gray-600">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-500">{entry.name}:</span>
          <span className="font-medium text-gray-800">
            {entry.dataKey === "returnPct"
              ? `${entry.value >= 0 ? "+" : ""}${entry.value.toFixed(2)}%`
              : formatEur(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// Component
// ===========================================================================

export default function CombinedChart({ data, kpis }: CombinedChartProps) {
  const [view, setView] = useState<ChartView>("general");

  const views: { key: ChartView; label: string }[] = [
    { key: "general", label: "General" },
    { key: "nav", label: "NAV" },
    { key: "rentabilidad", label: "Rentabilidad" },
    { key: "aportaciones", label: "Aportaciones" },
  ];

  const kpiCards = [
    { label: "Valor inicio", value: formatEur(kpis.valorInicio) },
    { label: "Valor fin", value: formatEur(kpis.valorFin) },
    {
      label: "Variacion",
      value: `${kpis.variacionPct >= 0 ? "+" : ""}${kpis.variacionPct.toFixed(2)}%`,
      sub: `${kpis.variacion >= 0 ? "+" : ""}${formatEur(kpis.variacion)}`,
      color: kpis.variacionPct >= 0 ? "text-green-600" : "text-red-600",
    },
    ...(kpis.mejorMes
      ? [{
          label: "Mejor mes",
          value: `+${kpis.mejorMes.pct.toFixed(2)}%`,
          sub: kpis.mejorMes.month,
          color: "text-green-600",
        }]
      : []),
    ...(kpis.peorMes
      ? [{
          label: "Peor mes",
          value: `${kpis.peorMes.pct.toFixed(2)}%`,
          sub: kpis.peorMes.month,
          color: "text-red-600",
        }]
      : []),
    {
      label: "Rent. periodo",
      value: `${kpis.rentabilidadPeriodo >= 0 ? "+" : ""}${kpis.rentabilidadPeriodo.toFixed(2)}%`,
      color: kpis.rentabilidadPeriodo >= 0 ? "text-green-600" : "text-red-600",
    },
    { label: "Aportaciones netas", value: formatEur(kpis.aportacionesNetas) },
  ];

  // Determine visible bars/lines based on view
  const showNav = view === "general" || view === "nav";
  const showReturn = view === "general" || view === "rentabilidad";
  const showFlows = view === "general" || view === "aportaciones";

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* KPIs row */}
      <div className="grid grid-cols-2 gap-3 border-b border-gray-100 p-5 sm:grid-cols-4 lg:grid-cols-7">
        {kpiCards.map((kpi) => (
          <div key={kpi.label}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              {kpi.label}
            </p>
            <p className={`mt-0.5 text-sm font-bold ${"color" in kpi && kpi.color ? kpi.color : "text-[#0B1D3A]"}`}>
              {kpi.value}
            </p>
            {"sub" in kpi && kpi.sub && (
              <p className="text-[10px] text-gray-400">{kpi.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* View selector */}
      <div className="flex items-center gap-1 border-b border-gray-100 px-5 py-3">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === v.key
                ? "bg-[#0B1D3A] text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="p-5">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                interval="preserveStartEnd"
              />

              {/* Left Y-axis: EUR values (NAV + flows) */}
              {(showNav || showFlows) && (
                <YAxis
                  yAxisId="eur"
                  tickFormatter={formatCompact}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  width={55}
                />
              )}

              {/* Right Y-axis: Return % */}
              {showReturn && (
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                  tick={{ fontSize: 10, fill: "#C9A84C" }}
                  width={50}
                />
              )}

              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />

              {/* NAV bars - navy */}
              {showNav && (
                <Bar
                  yAxisId="eur"
                  dataKey="nav"
                  name="NAV"
                  fill="#0B1D3A"
                  fillOpacity={0.85}
                  radius={[2, 2, 0, 0]}
                  barSize={view === "general" ? undefined : 30}
                />
              )}

              {/* Cash flows bars - light blue */}
              {showFlows && (
                <Bar
                  yAxisId="eur"
                  dataKey="flows"
                  name="Flujos"
                  fill="#93c5fd"
                  radius={[2, 2, 0, 0]}
                  barSize={view === "general" ? undefined : 24}
                />
              )}

              {/* Return line - gold */}
              {showReturn && (
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="returnPct"
                  name="Rentabilidad %"
                  stroke="#C9A84C"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#C9A84C", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#C9A84C", strokeWidth: 2, stroke: "#fff" }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-16 text-center text-sm text-gray-400">
            Sin datos suficientes para generar el grafico
          </p>
        )}
      </div>
    </div>
  );
}
