"use client";

import type { Position } from "@/lib/types/database";

interface PositionsTableProps {
  positions: Position[];
}

function formatEur(value: number): string {
  return value.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PositionsTable({ positions }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <p className="py-8 text-center text-gray-400">
        No hay posiciones para mostrar.
      </p>
    );
  }

  // Calcular totales
  const totalValue = positions.reduce((sum, p) => sum + (p.position_value ?? 0), 0);
  const totalCost = positions.reduce(
    (sum, p) => sum + (p.units ?? 0) * (p.avg_cost ?? 0),
    0
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-[#0B1D3A] text-xs uppercase text-white">
            <th className="px-3 py-2.5 font-medium">ISIN</th>
            <th className="px-3 py-2.5 font-medium">Producto</th>
            <th className="px-3 py-2.5 font-medium">Gestora</th>
            <th className="px-3 py-2.5 text-right font-medium">Titulos</th>
            <th className="px-3 py-2.5 text-right font-medium">Coste Medio</th>
            <th className="px-3 py-2.5 text-right font-medium">Precio</th>
            <th className="px-3 py-2.5 text-right font-medium">P&L</th>
            <th className="px-3 py-2.5 text-right font-medium">Valor</th>
            <th className="px-3 py-2.5 text-right font-medium">Peso</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, idx) => {
            const cost = (pos.units ?? 0) * (pos.avg_cost ?? 0);
            const pnl = (pos.position_value ?? 0) - cost;
            const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
            const weight = totalValue > 0 ? ((pos.position_value ?? 0) / totalValue) * 100 : 0;

            return (
              <tr
                key={pos.id}
                className={`border-b border-gray-100 last:border-0 ${
                  idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                } hover:bg-gray-50`}
              >
                <td className="px-3 py-2 font-mono text-xs">{pos.isin}</td>
                <td className="max-w-[200px] truncate px-3 py-2 text-xs">
                  {pos.product_name}
                </td>
                <td className="max-w-[150px] truncate px-3 py-2 text-xs text-gray-500">
                  {pos.manager ?? "—"}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  {(pos.units ?? 0).toLocaleString("es-ES", {
                    maximumFractionDigits: 4,
                  })}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  {formatEur(pos.avg_cost ?? 0)}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  {formatEur(pos.market_price ?? 0)}
                </td>
                <td
                  className={`px-3 py-2 text-right text-xs font-medium ${
                    pnl >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {pnl >= 0 ? "+" : ""}
                  {pnlPct.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold">
                  {formatEur(pos.position_value ?? 0)}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-[#C9A84C]"
                        style={{ width: `${Math.min(weight, 100)}%` }}
                      />
                    </div>
                    <span className="min-w-[3rem] text-right text-gray-600">
                      {weight.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#C9A84C] bg-gray-50 font-semibold">
            <td colSpan={6} className="px-3 py-2.5 text-right text-sm">
              Total
            </td>
            <td
              className={`px-3 py-2.5 text-right text-sm ${
                totalValue - totalCost >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {totalCost > 0
                ? `${totalValue - totalCost >= 0 ? "+" : ""}${(
                    ((totalValue - totalCost) / totalCost) *
                    100
                  ).toFixed(1)}%`
                : "—"}
            </td>
            <td className="px-3 py-2.5 text-right text-sm text-[#0B1D3A]">
              {formatEur(totalValue)}
            </td>
            <td className="px-3 py-2.5 text-right text-sm text-gray-500">
              100%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
