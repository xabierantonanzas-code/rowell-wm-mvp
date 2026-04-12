"use client";

import { useTheme } from "@/components/theme/ThemeContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  date: string;
  totalValue: number;
}

interface EvolutionChartProps {
  data: DataPoint[];
}

function formatEur(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M€`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k€`;
  }
  return `${value.toFixed(0)}€`;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", {
    month: "short",
    year: "2-digit",
  });
}

export default function EvolutionChart({ data }: EvolutionChartProps) {
  const { colors } = useTheme();
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        Sin datos suficientes para el grafico.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateLabel}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tickFormatter={formatEur}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          axisLine={{ stroke: "#e5e7eb" }}
          width={70}
        />
        <Tooltip
          formatter={(value: number) => [
            value.toLocaleString("es-ES", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            }),
            "Patrimonio",
          ]}
          labelFormatter={(label: string) =>
            new Date(label).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          }
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            fontSize: "13px",
          }}
        />
        <Line
          type="monotone"
          dataKey="totalValue"
          stroke={colors.primary}
          strokeWidth={2.5}
          dot={{ fill: colors.accent, r: 4, strokeWidth: 0 }}
          activeDot={{ fill: colors.accent, r: 6, strokeWidth: 2, stroke: colors.primary }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
