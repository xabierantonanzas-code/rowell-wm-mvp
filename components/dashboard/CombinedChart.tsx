"use client";

import { useState, useMemo } from "react";
import { useTheme } from "@/components/theme/ThemeContext";
import { AnimatedValue } from "@/components/ui/AnimatedValue";
import {
  ComposedChart,
  Bar,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ===========================================================================
// Types - MVP6 Edgard punto 2
// ===========================================================================
//
// Cambios respecto a la version anterior:
// - NAV apilado en 3 sub-categorias (cash + iic + rv) en lugar de una sola
//   barra. Cada bar usa stackId="nav".
// - Linea continua de "aportaciones netas acumuladas" en EUR (en vez de
//   barras de flujos por mes).
// - Eventos PLUS / MINUS individuales como Scatter con marcadores
//   verdes / rojos en la fecha exacta.
// - El label de eje X incluye dia (15 ene 25) en lugar de solo mes.

export interface FlowEvent {
  date: string;          // YYYY-MM-DD - fecha exacta de la operacion
  amount: number;        // > 0 PLUS, < 0 MINUS
  netAfter: number;      // aportaciones netas acumuladas tras este evento
}

export interface CombinedChartDataPoint {
  /** YYYY-MM-DD del snapshot (fin de mes o fecha real de consulta). */
  date: string;
  /** Label corto para eje X: "15 ene 25". */
  label: string;
  /** Desglose NAV apilado. Solo presente en snapshots reales. */
  cash?: number;
  iic?: number;
  rv?: number;
  /** Total NAV = cash + iic + rv. Solo presente en snapshots reales. */
  nav?: number;
  /** Rentabilidad % del periodo. Solo presente en snapshots reales. */
  returnPct?: number;
  /** Aportacion neta acumulada en este punto del tiempo. Siempre presente. */
  netContrib: number;
  /** Marcador PLUS (importe positivo) - solo en puntos de evento. */
  plusMarker?: number;
  /** Marcador MINUS (importe negativo) - solo en puntos de evento. */
  minusMarker?: number;
}

interface CombinedChartProps {
  data: CombinedChartDataPoint[];
  /** Lista de eventos PLUS/MINUS para los marcadores en linea. */
  flowEvents: FlowEvent[];
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
      {payload.map((entry: any) => {
        if (entry.value == null) return null;
        const isPct = entry.dataKey === "returnPct";
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-500">{entry.name}:</span>
            <span className="font-medium text-gray-800">
              {isPct
                ? `${entry.value >= 0 ? "+" : ""}${entry.value.toFixed(2)}%`
                : formatEur(entry.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ===========================================================================
// Component
// ===========================================================================

export default function CombinedChart({ data, flowEvents, kpis }: CombinedChartProps) {
  const { colors } = useTheme();
  const [view, setView] = useState<ChartView>("general");

  const views: { key: ChartView; label: string }[] = [
    { key: "general", label: "General" },
    { key: "nav", label: "NAV" },
    { key: "rentabilidad", label: "Rentabilidad" },
    { key: "aportaciones", label: "Aportaciones" },
  ];

  const kpiCards: { label: string; rawValue: number; format: (v: number) => string; sub?: string; color?: string }[] = [
    { label: "Valor inicio", rawValue: kpis.valorInicio, format: formatEur },
    { label: "Valor fin", rawValue: kpis.valorFin, format: formatEur },
    {
      label: "Variacion",
      rawValue: kpis.variacionPct,
      format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
      sub: `${kpis.variacion >= 0 ? "+" : ""}${formatEur(kpis.variacion)}`,
      color: kpis.variacionPct >= 0 ? "text-green-600" : "text-red-600",
    },
    ...(kpis.mejorMes
      ? [{
          label: "Mejor mes",
          rawValue: kpis.mejorMes.pct,
          format: (v: number) => `+${v.toFixed(2)}%`,
          sub: kpis.mejorMes.month,
          color: "text-green-600",
        }]
      : []),
    ...(kpis.peorMes
      ? [{
          label: "Peor mes",
          rawValue: kpis.peorMes.pct,
          format: (v: number) => `${v.toFixed(2)}%`,
          sub: kpis.peorMes.month,
          color: "text-red-600",
        }]
      : []),
    {
      label: "Rent. periodo",
      rawValue: kpis.rentabilidadPeriodo,
      format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
      color: kpis.rentabilidadPeriodo >= 0 ? "text-green-600" : "text-red-600",
    },
    { label: "Aportaciones netas", rawValue: kpis.aportacionesNetas, format: formatEur },
  ];

  // Determine visible series based on view
  const showNav = view === "general" || view === "nav";
  const showReturn = view === "general" || view === "rentabilidad";
  const showFlows = view === "general" || view === "aportaciones";

  // Construir el chartData manteniendo SOLO los snapshots reales como
  // puntos del eje X (con NAV apilado). Los flow events se asocian al
  // snapshot mas cercano (anterior o igual) y se renderizan como marcadores
  // PLUS / MINUS encima de la linea de aportaciones netas.
  //
  // Esto evita los "huecos" visuales que provocaba inyectar puntos
  // sinteticos sin NAV: el eje X se mantiene uniforme en snapshots reales.
  // (Si en un mismo snapshot hay varios eventos PLUS o MINUS, mostramos
  // un unico marker apuntando al netContrib final del snapshot.)
  const chartData = useMemo(() => {
    if (data.length === 0) return [];

    // Trabajamos sobre una copia mutable
    const points: CombinedChartDataPoint[] = data.map((p) => ({ ...p }));
    points.sort((a, b) => a.date.localeCompare(b.date));

    // Para cada flow event, encontrar el snapshot mas cercano (el primero
    // cuyo date >= event.date; si no hay, el ultimo)
    for (const e of flowEvents) {
      let target = points.find((p) => p.date >= e.date);
      if (!target) target = points[points.length - 1];
      if (!target) continue;
      if (e.amount > 0) target.plusMarker = target.netContrib;
      else target.minusMarker = target.netContrib;
    }

    return points;
  }, [data, flowEvents]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* KPIs row */}
      <div className="grid grid-cols-2 gap-2 border-b border-gray-100 p-3 sm:grid-cols-4 sm:gap-3 sm:p-5 lg:grid-cols-7">
        {kpiCards.map((kpi) => (
          <div key={kpi.label}>
            <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400 sm:text-[10px]">
              {kpi.label}
            </p>
            <p className={`mt-0.5 text-xs font-bold sm:text-sm ${kpi.color ? kpi.color : "text-[var(--color-primary)]"}`}>
              <AnimatedValue value={kpi.rawValue} format={kpi.format} />
            </p>
            {"sub" in kpi && kpi.sub && (
              <p className="text-[9px] text-gray-400 sm:text-[10px]">{kpi.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* View selector */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-100 px-3 py-2 sm:px-5 sm:py-3">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`flex-shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === v.key
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="overflow-x-auto p-3 sm:p-5">
        <div className="min-w-[480px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  interval="preserveStartEnd"
                />

                {/* Eje EUR (NAV apilado + aportaciones netas) */}
                {(showNav || showFlows) && (
                  <YAxis
                    yAxisId="eur"
                    tickFormatter={formatCompact}
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    width={55}
                  />
                )}

                {/* Eje % (rentabilidad) */}
                {showReturn && (
                  <YAxis
                    yAxisId="pct"
                    orientation="right"
                    tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                    tick={{ fontSize: 10, fill: colors.accent }}
                    width={50}
                  />
                )}

                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />

                {/* NAV apilado: efectivo (abajo) -> fondos -> RV (arriba)
                    Edgard MVP6 #2b */}
                {showNav && (
                  <>
                    <Bar
                      yAxisId="eur"
                      dataKey="cash"
                      stackId="nav"
                      name="Efectivo"
                      fill="#94a3b8"
                      fillOpacity={0.9}
                    />
                    <Bar
                      yAxisId="eur"
                      dataKey="iic"
                      stackId="nav"
                      name="Fondos (IIC)"
                      fill={colors.primary}
                      fillOpacity={0.9}
                    />
                    <Bar
                      yAxisId="eur"
                      dataKey="rv"
                      stackId="nav"
                      name="RV / ETFs"
                      fill="#6E8298"
                      fillOpacity={0.9}
                      radius={[2, 2, 0, 0]}
                    />
                  </>
                )}

                {/* Linea continua de aportaciones netas acumuladas
                    Edgard MVP6 #2a */}
                {showFlows && (
                  <Line
                    yAxisId="eur"
                    type="monotone"
                    dataKey="netContrib"
                    name="Aportaciones netas"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                  />
                )}

                {/* Marcadores PLUS (verde) y MINUS (rojo) en la fecha exacta
                    de cada operacion, sobre la linea de aportaciones netas
                    (Edgard MVP6 #2a). Solo aparecen en puntos sinteticos
                    inyectados en chartData con plusMarker / minusMarker. */}
                {showFlows && (
                  <Scatter
                    yAxisId="eur"
                    dataKey="plusMarker"
                    name="Aportacion (PLUS)"
                    fill="#10b981"
                    shape="circle"
                  />
                )}
                {showFlows && (
                  <Scatter
                    yAxisId="eur"
                    dataKey="minusMarker"
                    name="Reembolso (MINUS)"
                    fill="#ef4444"
                    shape="circle"
                  />
                )}

                {/* Linea de rentabilidad (centrada con NAV bars por usar
                    el mismo eje X). Edgard MVP6 #2c */}
                {showReturn && (
                  <Line
                    yAxisId="pct"
                    type="monotone"
                    dataKey="returnPct"
                    name="Rentabilidad %"
                    stroke={colors.accent}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: colors.accent, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: colors.accent, strokeWidth: 2, stroke: "#fff" }}
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

      {/* Leyenda compacta de los marcadores (los puntos PLUS/MINUS estan
          dentro del chart sobre la linea de aportaciones netas) */}
      {showFlows && flowEvents.length > 0 && (
        <div className="flex items-center gap-3 border-t border-gray-100 px-3 py-2 text-[10px] text-gray-500 sm:px-5">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[#10b981]" />
            Aportacion (PLUS)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[#ef4444]" />
            Reembolso (MINUS)
          </span>
          <span className="ml-auto tabular-nums">
            {flowEvents.length} movimientos en el periodo
          </span>
        </div>
      )}
    </div>
  );
}
