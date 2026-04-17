"use client";

import { useState, useMemo, useCallback } from "react";
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
import { Minus, Plus } from "lucide-react";

// ===========================================================================
// Types - MVP6 Edgard punto 2
// ===========================================================================

export interface FlowEvent {
  date: string;          // YYYY-MM-DD - fecha exacta de la operacion
  amount: number;        // > 0 PLUS, < 0 MINUS
  netAfter: number;      // aportaciones netas acumuladas tras este evento
  operationType?: string;
  productName?: string;
  isin?: string;
}

export interface CombinedChartDataPoint {
  /** YYYY-MM-DD del snapshot (fin de mes o fecha real de consulta). */
  date: string;
  /** Label corto para eje X: "15 ene 25". */
  label: string;
  /** Numeric timestamp for proportional axis. */
  ts: number;
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
  /** Metadata for tooltip on flow markers. */
  flowMeta?: {
    type: "plus" | "minus";
    amount: number;
    operationType?: string;
    productName?: string;
    isin?: string;
  };
  /** Whether this is a synthetic point (flow event, no NAV). */
  synthetic?: boolean;
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
type Granularity = "semanal" | "mensual" | "trimestral" | "anual";

const GRANULARITY_ORDER: Granularity[] = ["semanal", "mensual", "trimestral", "anual"];
const GRANULARITY_LABELS: Record<Granularity, string> = {
  semanal: "Sem",
  mensual: "Mes",
  trimestral: "Trim",
  anual: "Año",
};

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

function dateToTs(dateStr: string): number {
  return new Date(dateStr).getTime();
}

function formatDateLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

/** Granularity key for a date (for rollup). */
function granularityKey(dateStr: string, g: Granularity): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  switch (g) {
    case "semanal":
      return dateStr; // no rollup
    case "mensual":
      return `${y}-${String(m).padStart(2, "0")}`;
    case "trimestral":
      return `${y}-Q${Math.ceil(m / 3)}`;
    case "anual":
      return String(y);
  }
}

/** Roll up snapshot data: keep last snapshot per granularity bucket. */
function rollupSnapshots(
  points: CombinedChartDataPoint[],
  granularity: Granularity
): CombinedChartDataPoint[] {
  if (granularity === "semanal") return points;

  const buckets = new Map<string, CombinedChartDataPoint>();
  for (const p of points) {
    if (p.synthetic) continue; // flow-only points don't roll up
    const key = granularityKey(p.date, granularity);
    // Keep last (most recent) snapshot per bucket
    const existing = buckets.get(key);
    if (!existing || p.date > existing.date) {
      buckets.set(key, { ...p });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
}

// ===========================================================================
// Custom Tooltip
// ===========================================================================

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  // Check if this is a flow marker point with metadata
  const flowMeta = payload[0]?.payload?.flowMeta;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
      <p className="mb-2 text-xs font-semibold text-gray-600">
        {typeof label === "number"
          ? new Date(label).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" })
          : label}
      </p>
      {flowMeta && (
        <div className="mb-2 border-b border-gray-100 pb-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`inline-block h-2 w-2 rounded-full ${flowMeta.type === "plus" ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="font-medium">
              {flowMeta.type === "plus" ? "Aportacion" : "Reembolso"}: {formatEur(Math.abs(flowMeta.amount))}
            </span>
          </div>
          {flowMeta.operationType && (
            <p className="mt-0.5 text-[10px] text-gray-500">{flowMeta.operationType}</p>
          )}
          {flowMeta.isin && (
            <p className="text-[10px] text-gray-400">{flowMeta.isin}{flowMeta.productName ? ` — ${flowMeta.productName}` : ""}</p>
          )}
        </div>
      )}
      {payload.map((entry: any) => {
        if (entry.value == null) return null;
        // Skip marker dataKeys in generic list
        if (entry.dataKey === "plusMarker" || entry.dataKey === "minusMarker") return null;
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
  const [granularity, setGranularity] = useState<Granularity>("semanal");

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

  // Build chart data with numeric timestamps for proportional axis.
  // Snapshot points have NAV bars; flow events are injected as synthetic
  // points at their exact dates with markers.
  const chartData = useMemo(() => {
    if (data.length === 0) return [];

    // Start with snapshot points (add ts)
    const snapshotPoints: CombinedChartDataPoint[] = data.map((p) => ({
      ...p,
      ts: dateToTs(p.date),
      label: formatDateLabel(p.date),
    }));

    // Inject flow events as synthetic points at exact dates
    const allPoints = [...snapshotPoints];

    for (const e of flowEvents) {
      const ts = dateToTs(e.date);
      // Check if a snapshot already exists on this exact date
      const existing = allPoints.find((p) => p.date === e.date && !p.synthetic);
      if (existing) {
        // Attach marker to existing snapshot point
        if (e.amount > 0) {
          existing.plusMarker = existing.netContrib;
          existing.flowMeta = {
            type: "plus",
            amount: e.amount,
            operationType: e.operationType,
            productName: e.productName,
            isin: e.isin,
          };
        } else {
          existing.minusMarker = existing.netContrib;
          existing.flowMeta = {
            type: "minus",
            amount: e.amount,
            operationType: e.operationType,
            productName: e.productName,
            isin: e.isin,
          };
        }
      } else {
        // Create synthetic point at exact flow date
        const syntheticPoint: CombinedChartDataPoint = {
          date: e.date,
          label: formatDateLabel(e.date),
          ts,
          netContrib: e.netAfter,
          synthetic: true,
          plusMarker: e.amount > 0 ? e.netAfter : undefined,
          minusMarker: e.amount < 0 ? e.netAfter : undefined,
          flowMeta: {
            type: e.amount > 0 ? "plus" : "minus",
            amount: e.amount,
            operationType: e.operationType,
            productName: e.productName,
            isin: e.isin,
          },
        };
        allPoints.push(syntheticPoint);
      }
    }

    // Sort by timestamp
    allPoints.sort((a, b) => a.ts - b.ts);

    return allPoints;
  }, [data, flowEvents]);

  // Apply granularity rollup (only affects snapshot/NAV points)
  const displayData = useMemo(() => {
    if (granularity === "semanal") return chartData;

    // Roll up snapshots; keep ALL flow event points at exact dates
    const snapshots = chartData.filter((p) => !p.synthetic);
    const flows = chartData.filter((p) => p.synthetic);
    const rolledUp = rollupSnapshots(snapshots, granularity);

    // Merge and sort
    return [...rolledUp, ...flows].sort((a, b) => a.ts - b.ts);
  }, [chartData, granularity]);

  const granIdx = GRANULARITY_ORDER.indexOf(granularity);
  const canZoomOut = granIdx < GRANULARITY_ORDER.length - 1;
  const canZoomIn = granIdx > 0;

  const handleZoomOut = useCallback(() => {
    if (canZoomOut) setGranularity(GRANULARITY_ORDER[granIdx + 1]);
  }, [canZoomOut, granIdx]);

  const handleZoomIn = useCallback(() => {
    if (canZoomIn) setGranularity(GRANULARITY_ORDER[granIdx - 1]);
  }, [canZoomIn, granIdx]);

  // Compute tick values for the XAxis (only from non-synthetic points)
  const tickValues = useMemo(() => {
    const nonSynthetic = displayData.filter((p) => !p.synthetic);
    if (nonSynthetic.length <= 12) return nonSynthetic.map((p) => p.ts);
    // Thin out to ~10 ticks
    const step = Math.ceil(nonSynthetic.length / 10);
    const ticks = nonSynthetic
      .filter((_, i) => i % step === 0 || i === nonSynthetic.length - 1)
      .map((p) => p.ts);
    return ticks;
  }, [displayData]);

  // Domain for X axis
  const xDomain = useMemo(() => {
    if (displayData.length === 0) return [0, 1];
    const min = displayData[0].ts;
    const max = displayData[displayData.length - 1].ts;
    // Add small padding
    const pad = (max - min) * 0.02;
    return [min - pad, max + pad];
  }, [displayData]);

  // Compute bar width based on snapshot count.
  // Fewer snapshots = wider bars (annual has ~4, weekly has ~100+).
  const snapshotCount = displayData.filter((p) => !p.synthetic).length;
  const barSize = snapshotCount <= 2 ? 50
    : snapshotCount <= 5 ? 36
    : snapshotCount <= 12 ? 20
    : snapshotCount <= 30 ? 12
    : snapshotCount <= 60 ? 8
    : 5;

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

      {/* View selector + Zoom controls */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 sm:px-5 sm:py-3">
        <div className="flex items-center gap-1 overflow-x-auto">
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

        {/* Zoom +/- and granularity label */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            {GRANULARITY_LABELS[granularity]}
          </span>
          <button
            onClick={handleZoomIn}
            disabled={!canZoomIn}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            title="Mas detalle"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            disabled={!canZoomOut}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            title="Menos detalle"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="overflow-x-auto p-3 sm:p-5">
        <div className="min-w-[480px]">
          {displayData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={displayData} barSize={barSize} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={xDomain}
                  ticks={tickValues}
                  tickFormatter={(ts: number) =>
                    new Date(ts).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })
                  }
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
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

                {/* NAV apilado: efectivo (abajo) -> fondos -> RV (arriba) */}
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

                {/* Linea continua de aportaciones netas acumuladas */}
                {showFlows && (
                  <Line
                    yAxisId="eur"
                    type="stepAfter"
                    dataKey="netContrib"
                    name="Aportaciones netas"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                    connectNulls
                  />
                )}

                {/* Marcadores PLUS (verde) y MINUS (rojo) en fecha exacta */}
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

                {/* Linea de rentabilidad */}
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
                    connectNulls
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

      {/* Leyenda compacta de los marcadores */}
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
