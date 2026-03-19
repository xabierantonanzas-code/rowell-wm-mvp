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

  const totalValue = positions.reduce((sum, p) => sum + (p.position_value ?? 0), 0);
  const totalCost = positions.reduce(
    (sum, p) => sum + (p.units ?? 0) * (p.avg_cost ?? 0),
    0
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-[#0B1D3A] text-xs uppercase text-white">
            <th className="px-4 py-3 font-medium">Producto</th>
            <th className="px-4 py-3 font-medium">ISIN</th>
            <th className="px-4 py-3 font-medium">Gestora</th>
            <th className="px-4 py-3 text-right font-medium">Títulos</th>
            <th className="px-4 py-3 text-right font-medium">Coste medio</th>
            <th className="px-4 py-3 text-right font-medium">Precio</th>
            <th className="px-4 py-3 text-right font-medium">P&L</th>
            <th className="px-4 py-3 text-right font-medium">Valor</th>
            <th className="px-4 py-3 text-right font-medium">Peso</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, idx) => {
            const cost = (pos.units ?? 0) * (pos.avg_cost ?? 0);
            const pnl = (pos.position_value ?? 0) - cost;
            const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
            const weight = totalValue > 0
              ? ((pos.position_value ?? 0) / totalValue) * 100
              : 0;

            return (
              <tr
                key={pos.id}
                className={`border-b border-gray-100 last:border-0 transition-colors duration-100 hover:bg-[#F5F3EE] ${
                  idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                }`}
              >
                <td className="max-w-[180px] px-4 py-3">
                  <p className="truncate text-xs font-semibold text-[#0B1D3A]">
                    {pos.product_name}
                  </p>
                </td>
                <td className="px-4 py-3 font-mono text-[10px] text-gray-400">
                  {pos.isin}
                </td>
                <td className="max-w-[120px] px-4 py-3 text-xs text-gray-500 truncate">
                  {pos.manager ?? "—"}
                </td>
                <td className="px-4 py-3 text-right text-xs">
                  {(pos.units ?? 0).toLocaleString("es-ES", { maximumFractionDigits: 4 })}
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-600">
                  {formatEur(pos.avg_cost ?? 0)}
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-600">
                  {formatEur(pos.market_price ?? 0)}
                </td>
                <td className={`px-4 py-3 text-right text-xs font-semibold ${
                  pnl >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-right text-xs font-bold text-[#0B1D3A]">
                  {formatEur(pos.position_value ?? 0)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs text-gray-500 tabular-nums">
                      {weight.toFixed(1)}%
                    </span>
                    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-[#C9A84C] transition-all duration-500"
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
          <tr className="border-t-2 border-[#C9A84C] bg-[#F5F3EE]">
            <td colSpan={6} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[#0B1D3A]">
              Total cartera
            </td>
            <td className={`px-4 py-3 text-right text-xs font-bold ${
              totalValue - totalCost >= 0 ? "text-green-600" : "text-red-600"
            }`}>
              {totalCost > 0
                ? `${totalValue - totalCost >= 0 ? "+" : ""}${(
                    ((totalValue - totalCost) / totalCost) * 100
                  ).toFixed(2)}%`
                : "—"}
            </td>
            <td className="px-4 py-3 text-right text-xs font-bold text-[#0B1D3A]">
              {formatEur(totalValue)}
            </td>
            <td className="px-4 py-3 text-right text-xs font-bold text-gray-500">
              100%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
