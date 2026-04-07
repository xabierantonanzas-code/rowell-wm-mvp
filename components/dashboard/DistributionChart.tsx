"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { Position } from "@/lib/types/database";

interface DistributionChartProps {
  positions: Position[];
}

const COLORS = [
  "#3D4F63", // rowell navy
  "#B8965A", // rowell gold
  "#2563eb", // blue
  "#059669", // green
  "#d97706", // amber
  "#7c3aed", // violet
  "#dc2626", // red
  "#0891b2", // cyan
  "#4f46e5", // indigo
  "#db2777", // pink
];

function formatEur(value: number): string {
  return value.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default function DistributionChart({
  positions,
}: DistributionChartProps) {
  if (positions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        Sin datos para mostrar.
      </p>
    );
  }

  // Agrupar por gestora
  const byManager = new Map<string, number>();
  for (const pos of positions) {
    const manager = pos.manager || "Otros";
    const current = byManager.get(manager) ?? 0;
    byManager.set(manager, current + (pos.position_value ?? 0));
  }

  // Ordenar por valor y tomar top 8, agrupar el resto en "Otros"
  const sorted = Array.from(byManager.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 8);
  const othersValue = sorted.slice(8).reduce((sum, [, v]) => sum + v, 0);

  const chartData = top.map(([name, value]) => ({
    name: name.length > 25 ? name.slice(0, 22) + "..." : name,
    value,
  }));

  if (othersValue > 0) {
    chartData.push({ name: "Otros", value: othersValue });
  }

  const totalValue = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) =>
            `${name} (${(percent * 100).toFixed(0)}%)`
          }
          labelLine={false}
        >
          {chartData.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [
            `${formatEur(value)} (${((value / totalValue) * 100).toFixed(1)}%)`,
            "Valor",
          ]}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            fontSize: "13px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
