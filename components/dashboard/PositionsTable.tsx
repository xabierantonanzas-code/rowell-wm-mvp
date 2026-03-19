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
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs uppercase text-gray-500">
            <th className="px-3 py-2">ISIN</th>
            <th className="px-3 py-2">Producto</th>
            <th className="px-3 py-2">Gestora</th>
            <th className="px-3 py-2 text-right">Titulos</th>
            <th className="px-3 py-2 text-right">Coste Medio</th>
            <th className="px-3 py-2 text-right">Precio</th>
            <th className="px-3 py-2 text-right">P&L</th>
            <th className="px-3 py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => {
            const cost = (pos.units ?? 0) * (pos.avg_cost ?? 0);
            const pnl = (pos.position_value ?? 0) - cost;
            const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

            return (
              <tr
                key={pos.id}
                className="border-b last:border-0 hover:bg-gray-50"
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
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 font-semibold">
            <td colSpan={6} className="px-3 py-2 text-right text-sm">
              Total
            </td>
            <td
              className={`px-3 py-2 text-right text-sm ${
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
            <td className="px-3 py-2 text-right text-sm text-rowell-navy">
              {formatEur(totalValue)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
