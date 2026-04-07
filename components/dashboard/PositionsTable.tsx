"use client";

import type { Position } from "@/lib/types/database";
import { useMemo } from "react";
import { classifyProduct, type ProductType } from "@/lib/product-type";
import {
  eurCostForPosition,
  type EurCostInfo,
} from "@/lib/eur-cost-fifo";

interface PositionsTableProps {
  positions: Position[];
  /**
   * Map ISIN -> coste EUR FIFO calculado a partir de operations.
   * Si esta presente, el P&L EUR mostrado refleja el efecto divisa real
   * (coste = EURs realmente puestos en el momento de cada compra).
   * Si NO esta presente, se aproxima con el fx_rate del snapshot actual.
   */
  eurCostMap?: Map<string, EurCostInfo>;
}

function formatEur(value: number): string {
  return value.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Formatea un numero en su divisa original. Cuando la divisa NO es EUR
// mostramos el codigo ISO al lado del valor (USD, CHF, GBP, etc.).
function formatNativeAmount(value: number, currency: string): string {
  const cur = (currency || "EUR").toUpperCase();
  const num = value.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (cur === "EUR") return `${num} €`;
  return `${num} ${cur}`;
}

interface SectionProps {
  title: string;
  subtitle: string;
  rows: Position[];
  totalValueAll: number;
  eurCostMap?: Map<string, EurCostInfo>;
}

function PositionsSection({
  title,
  subtitle,
  rows,
  totalValueAll,
  eurCostMap,
}: SectionProps) {
  if (rows.length === 0) return null;

  const hasFifo = !!eurCostMap;

  const sectionTotal = rows.reduce((s, p) => s + (p.position_value ?? 0), 0);
  const sectionCostEurApprox = rows.reduce((s, p) => {
    // Si tenemos FIFO, usar coste real EUR; si no, aproximar con fx actual.
    if (hasFifo) {
      const fifoCost = eurCostForPosition(p.isin, p.units, eurCostMap);
      if (fifoCost != null) return s + fifoCost;
    }
    const native = (p.units ?? 0) * (p.avg_cost ?? 0);
    const fx = p.fx_rate ?? 1;
    return s + native * fx;
  }, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-baseline justify-between border-b border-gray-100 bg-[#F5F5F5] px-4 py-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#3D4F63]">
            {title}
          </h4>
          <p className="text-[10px] text-gray-500">{subtitle}</p>
        </div>
        <p className="text-xs font-bold text-[#3D4F63]">{formatEur(sectionTotal)}</p>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-[#3D4F63] text-[10px] uppercase text-white">
            <th className="px-3 py-2 font-medium">Producto</th>
            <th className="px-3 py-2 font-medium">ISIN</th>
            <th className="px-3 py-2 text-right font-medium">Títulos</th>
            <th className="px-3 py-2 text-right font-medium">Coste medio</th>
            <th className="px-3 py-2 text-right font-medium">Precio</th>
            <th className="px-3 py-2 text-right font-medium" title="P&L sin efecto divisa, en divisa original">
              P&L %
            </th>
            <th className="px-3 py-2 text-right font-medium">P&L EUR</th>
            <th className="px-3 py-2 text-right font-medium">Valor (EUR)</th>
            <th className="px-3 py-2 text-right font-medium">Peso</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((pos, idx) => {
            const units = pos.units ?? 0;
            const avgCost = pos.avg_cost ?? 0;
            const price = pos.market_price ?? 0;
            const valueEur = pos.position_value ?? 0;
            const fx = pos.fx_rate ?? 1;
            const cur = (pos.currency ?? "EUR").toUpperCase();

            // P&L en divisa original (sin efecto divisa)
            const costNative = units * avgCost;
            const valueNative = units * price;
            const pnlNative = valueNative - costNative;
            const pnlPct = costNative > 0 ? (pnlNative / costNative) * 100 : 0;

            // P&L EUR: si tenemos FIFO usar coste EUR real (con efecto divisa);
            // si no, aproximar con fx actual.
            const fifoCostEur = hasFifo
              ? eurCostForPosition(pos.isin, units, eurCostMap)
              : null;
            const costEurUsed = fifoCostEur ?? costNative * fx;
            const pnlEurApprox = valueEur - costEurUsed;

            const weight = totalValueAll > 0 ? (valueEur / totalValueAll) * 100 : 0;

            return (
              <tr
                key={pos.id}
                className={`border-b border-gray-100 last:border-0 transition-colors duration-100 hover:bg-[#F5F5F5] ${
                  idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                }`}
              >
                <td className="max-w-[200px] px-3 py-2">
                  <p className="truncate text-xs font-semibold text-[#3D4F63]">
                    {pos.product_name}
                  </p>
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-gray-400">
                  {pos.isin}
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">
                  {units.toLocaleString("es-ES", { maximumFractionDigits: 4 })}
                </td>
                <td className="px-3 py-2 text-right text-xs text-gray-600 tabular-nums">
                  {formatNativeAmount(avgCost, cur)}
                </td>
                <td className="px-3 py-2 text-right text-xs text-gray-600 tabular-nums">
                  {formatNativeAmount(price, cur)}
                </td>
                <td
                  className={`px-3 py-2 text-right text-xs font-semibold tabular-nums ${
                    pnlPct >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {pnlPct >= 0 ? "+" : ""}
                  {pnlPct.toFixed(2)}%
                </td>
                <td
                  className={`px-3 py-2 text-right text-xs font-semibold tabular-nums ${
                    pnlEurApprox >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {pnlEurApprox >= 0 ? "+" : ""}
                  {formatEur(pnlEurApprox)}
                </td>
                <td className="px-3 py-2 text-right text-xs font-bold text-[#3D4F63] tabular-nums">
                  {formatEur(valueEur)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs text-gray-500 tabular-nums">
                      {weight.toFixed(1)}%
                    </span>
                    <div className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-[#B8965A] transition-all duration-500"
                        style={{ width: `${Math.min(weight, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#B8965A] bg-[#F5F5F5]">
            <td colSpan={5} className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-[#3D4F63]">
              Subtotal {title}
            </td>
            <td
              className={`px-3 py-2 text-right text-xs font-bold tabular-nums ${
                sectionTotal - sectionCostEurApprox >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {sectionCostEurApprox > 0
                ? `${sectionTotal - sectionCostEurApprox >= 0 ? "+" : ""}${(
                    ((sectionTotal - sectionCostEurApprox) / sectionCostEurApprox) *
                    100
                  ).toFixed(2)}%`
                : "—"}
            </td>
            <td
              className={`px-3 py-2 text-right text-xs font-bold tabular-nums ${
                sectionTotal - sectionCostEurApprox >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {sectionTotal - sectionCostEurApprox >= 0 ? "+" : ""}
              {formatEur(sectionTotal - sectionCostEurApprox)}
            </td>
            <td className="px-3 py-2 text-right text-xs font-bold text-[#3D4F63] tabular-nums">
              {formatEur(sectionTotal)}
            </td>
            <td className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 tabular-nums">
              {totalValueAll > 0 ? ((sectionTotal / totalValueAll) * 100).toFixed(1) : "0.0"}%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function PositionsTable({ positions, eurCostMap }: PositionsTableProps) {
  const totalValue = useMemo(
    () => positions.reduce((sum, p) => sum + (p.position_value ?? 0), 0),
    [positions]
  );

  const { iic, rv } = useMemo(() => {
    const iic: Position[] = [];
    const rv: Position[] = [];
    for (const p of positions) {
      const t: ProductType = classifyProduct(p.isin, p.product_name);
      (t === "iic" ? iic : rv).push(p);
    }
    // Orden por valor descendente dentro de cada seccion
    iic.sort((a, b) => (b.position_value ?? 0) - (a.position_value ?? 0));
    rv.sort((a, b) => (b.position_value ?? 0) - (a.position_value ?? 0));
    return { iic, rv };
  }, [positions]);

  if (positions.length === 0) {
    return (
      <p className="py-8 text-center text-gray-400">
        No hay posiciones para mostrar.
      </p>
    );
  }

  const hasFifo = !!eurCostMap;

  return (
    <div className="space-y-4">
      <PositionsSection
        title="IIC — Fondos de inversión"
        subtitle="Vehiculos colectivos UCITS y similares"
        rows={iic}
        totalValueAll={totalValue}
        eurCostMap={eurCostMap}
      />
      <PositionsSection
        title="RV — Acciones / ETFs"
        subtitle="Renta variable directa y vehiculos cotizados"
        rows={rv}
        totalValueAll={totalValue}
        eurCostMap={eurCostMap}
      />
      <p className="px-1 text-[10px] text-gray-400">
        {hasFifo
          ? "P&L EUR refleja el efecto divisa real: coste reconstruido por FIFO sobre el registro de operaciones."
          : "P&L EUR es aproximado: usa el tipo de cambio del último snapshot, no el del momento de compra."}
      </p>
    </div>
  );
}
