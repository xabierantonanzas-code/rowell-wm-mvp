"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
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

interface AccountSeries {
  accountId: string;
  label: string;      // account label or last 8 digits
  data: { date: string; totalValue: number }[];
}

interface StrategyChartProps {
  series: AccountSeries[];
}

// ===========================================================================
// Strategy ordering & colors
// ===========================================================================

// Order: conservadora < moderada < agresiva < others (bottom to top)
const STRATEGY_ORDER: Record<string, number> = {
  conservadora: 0,
  conservador: 0,
  moderada: 1,
  moderado: 1,
  equilibrada: 1,
  equilibrado: 1,
  agresiva: 2,
  agresivo: 2,
  dinamica: 2,
  dinamico: 2,
};

function getStrategyRank(label: string): number {
  const lower = label.toLowerCase();
  for (const [key, rank] of Object.entries(STRATEGY_ORDER)) {
    if (lower.includes(key)) return rank;
  }
  return 3; // "otras"
}

// Palette: graduated Rowell tones
const AREA_COLORS = [
  "#3D4F63",  // Navy (conservadora)
  "#3D4F63",  // Medium navy (moderada)
  "#B8965A",  // Gold (agresiva)
  "#2563eb",  // Blue
  "#059669",  // Green
  "#7c3aed",  // Violet
  "#d97706",  // Amber
  "#dc2626",  // Red
];

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

  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
      <p className="mb-2 text-xs font-semibold text-gray-600">{label}</p>
      {payload
        .slice()
        .reverse()
        .map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="flex-1 text-gray-500">{entry.name}</span>
            <span className="font-medium text-gray-800">{formatEur(entry.value)}</span>
          </div>
        ))}
      <div className="mt-1.5 border-t border-gray-100 pt-1.5 text-xs font-semibold text-[#3D4F63]">
        Total: {formatEur(total)}
      </div>
    </div>
  );
}

// ===========================================================================
// Component
// ===========================================================================

export default function StrategyChart({ series }: StrategyChartProps) {
  // Sort series: conservadora → moderada → agresiva → otras (bottom to top)
  const sortedSeries = useMemo(
    () =>
      [...series].sort(
        (a, b) => getStrategyRank(a.label) - getStrategyRank(b.label)
      ),
    [series]
  );

  // Build unified chart data: each date has a value for each account
  const chartData = useMemo(() => {
    // Collect all unique dates
    const allDates = new Set<string>();
    for (const s of sortedSeries) {
      for (const d of s.data) {
        allDates.add(d.date);
      }
    }

    const dates = Array.from(allDates).sort();

    // For each date, get the value from each account (carry forward if missing)
    const lastValues = new Map<string, number>();

    return dates.map((date) => {
      const point: Record<string, any> = {
        date: new Date(date).toLocaleDateString("es-ES", {
          month: "short",
          year: "2-digit",
        }),
      };

      for (const s of sortedSeries) {
        const match = s.data.find((d) => d.date === date);
        if (match) {
          lastValues.set(s.accountId, match.totalValue);
        }
        point[s.label] = lastValues.get(s.accountId) ?? 0;
      }

      return point;
    });
  }, [sortedSeries]);

  if (chartData.length === 0 || sortedSeries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
        <p className="text-sm text-gray-400">Sin datos suficientes para el grafico de estrategias</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-6">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#3D4F63] sm:mb-4 sm:text-sm">
        Evolucion por Estrategia
      </h3>
      <div className="overflow-x-auto">
      <div className="min-w-[480px]">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatCompact}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          {sortedSeries.map((s, i) => (
            <Area
              key={s.accountId}
              type="monotone"
              dataKey={s.label}
              stackId="1"
              fill={AREA_COLORS[i % AREA_COLORS.length]}
              fillOpacity={0.7}
              stroke={AREA_COLORS[i % AREA_COLORS.length]}
              strokeWidth={1.5}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      </div>
      </div>
    </div>
  );
}
