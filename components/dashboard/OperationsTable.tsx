"use client";

import type { Operation } from "@/lib/types/database";
import { ArrowUpRight, ArrowDownLeft, RefreshCw } from "lucide-react";
import { classifyFlow } from "@/lib/operations-taxonomy";

interface OperationsTableProps {
  operations: Operation[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
}

function formatEur(value: number): string {
  return value.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getOperationIcon(type: string | null) {
  const cat = classifyFlow(type ?? "");
  if (cat === "plus") {
    return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
  }
  if (cat === "minus") {
    return <ArrowUpRight className="h-4 w-4 text-red-600" />;
  }
  return <RefreshCw className="h-4 w-4 text-blue-500" />;
}

function getOperationColor(type: string | null): string {
  const cat = classifyFlow(type ?? "");
  if (cat === "plus") return "text-green-600";
  if (cat === "minus") return "text-red-600";
  return "text-blue-600";
}

export default function OperationsTable({
  operations,
  total,
  page,
  totalPages,
  onPageChange,
}: OperationsTableProps) {
  if (operations.length === 0) {
    return (
      <p className="py-8 text-center text-gray-400">
        No hay operaciones para el periodo seleccionado.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-gray-500">
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2 text-right">Titulos</th>
              <th className="px-3 py-2 text-right">Importe EUR</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((op) => (
              <tr
                key={op.id}
                className="border-b last:border-0 hover:bg-gray-50"
              >
                <td className="px-3 py-2">
                  {getOperationIcon(op.operation_type)}
                </td>
                <td className="px-3 py-2 text-xs font-mono">
                  {formatDate(op.operation_date)}
                </td>
                <td className={`px-3 py-2 text-xs font-medium ${getOperationColor(op.operation_type)}`}>
                  {op.operation_type ?? "\u2014"}
                </td>
                <td className="max-w-[200px] truncate px-3 py-2 text-xs">
                  {op.product_name ?? "\u2014"}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  {op.units != null
                    ? op.units.toLocaleString("es-ES", { maximumFractionDigits: 4 })
                    : "\u2014"}
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold">
                  {op.eur_amount != null ? formatEur(op.eur_amount) : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginacion */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-xs text-gray-400">
            {total} operaciones en total
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="rounded-md px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="flex items-center px-2 text-xs text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="rounded-md px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
