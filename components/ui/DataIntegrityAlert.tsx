"use client";

import { AlertTriangle } from "lucide-react";

interface DataIntegrityAlertProps {
  kpiTotal: number;
  chartTotal: number;
  positionsCount: number;
  historyPoints: number;
}

/**
 * Compares KPI total value with the latest chart data point.
 * Shows a warning if they diverge by more than 5%, indicating
 * data might be incomplete (pagination issues, missing snapshots, etc.)
 */
export default function DataIntegrityAlert({
  kpiTotal,
  chartTotal,
  positionsCount,
  historyPoints,
}: DataIntegrityAlertProps) {
  const issues: string[] = [];

  // Check KPI vs chart divergence
  if (kpiTotal > 0 && chartTotal > 0) {
    const divergence = Math.abs(kpiTotal - chartTotal) / kpiTotal;
    if (divergence > 0.05) {
      const pct = (divergence * 100).toFixed(1);
      issues.push(
        `El grafico muestra ${formatCompact(chartTotal)} pero los KPIs muestran ${formatCompact(kpiTotal)} (${pct}% de diferencia). Posible problema de carga de datos.`
      );
    }
  }

  // Check if there are positions but no history
  if (positionsCount > 0 && historyPoints === 0) {
    issues.push(
      `Hay ${positionsCount} posiciones pero 0 puntos de historial. Los graficos no mostraran datos.`
    );
  }

  // Check if history has very few points
  if (historyPoints > 0 && historyPoints < 2) {
    issues.push(
      `Solo hay ${historyPoints} punto(s) de historial. Se necesitan al menos 2 para mostrar evolucion.`
    );
  }

  if (issues.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-800">
            Alerta de integridad de datos
          </p>
          {issues.map((issue, i) => (
            <p key={i} className="text-xs text-amber-700">
              {issue}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M€`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k€`;
  return `${Math.round(value)}€`;
}
