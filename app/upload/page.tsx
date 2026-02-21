"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ExcelUpload from "@/components/upload/ExcelUpload";
import type { UploadResult } from "@/components/upload/ExcelUpload";
import { setUploadedData } from "@/lib/utils/storage";
import type { SerializedPosition, SerializedOperation, SerializedLiquidity } from "@/lib/utils/storage";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowRight, FileSpreadsheet, CheckCircle2 } from "lucide-react";

// ===========================================================================
// Pagina de Upload
// ===========================================================================

export default function UploadPage() {
  const router = useRouter();
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleUploadComplete = (uploadResult: UploadResult) => {
    if (!uploadResult.success || !uploadResult.data || !uploadResult.stats) return;

    // Guardar en localStorage
    setUploadedData({
      positions: uploadResult.data.positions as unknown as { date: Date; isin: string; productName: string; shares: number; avgCost: number; marketPrice: number; totalValue: number }[],
      operations: uploadResult.data.operations as unknown as { date: Date; type: "Compra" | "Venta" | "Aportacion" | "Reembolso"; isin: string; name: string; amount: number; shares: number }[],
      liquidity: uploadResult.data.liquidity as unknown as { date: Date; type: string; amount: number; balance: number }[],
      stats: uploadResult.stats,
    });

    setResult(uploadResult);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-10">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#1e3a8a]">
          Cargar Datos Excel
        </h1>
        <p className="mt-1 text-gray-500">
          Sube los archivos Excel de Mapfre para actualizar tu dashboard
        </p>
      </header>

      <div className="mx-auto max-w-4xl space-y-8">
        {/* Upload Component */}
        <div className="flex justify-center">
          <ExcelUpload onUploadComplete={handleUploadComplete} />
        </div>

        {/* Results Table */}
        {result?.success && result.data && result.stats && (
          <>
            {/* Summary Stats */}
            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#1e3a8a]">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Resumen del Procesamiento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatBlock
                    label="Posiciones"
                    valid={result.stats.positions.validRows}
                    total={result.stats.positions.totalRows}
                    skipped={result.stats.positions.skippedRows}
                  />
                  <StatBlock
                    label="Operaciones"
                    valid={result.stats.operations.validRows}
                    total={result.stats.operations.totalRows}
                    skipped={result.stats.operations.skippedRows}
                  />
                  <StatBlock
                    label="Liquidez"
                    valid={result.stats.liquidity.validRows}
                    total={result.stats.liquidity.totalRows}
                    skipped={result.stats.liquidity.skippedRows}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Positions Table */}
            {(result.data.positions as SerializedPosition[]).length > 0 && (
              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#1e3a8a]">
                    <FileSpreadsheet className="h-4 w-4" />
                    Posiciones ({(result.data.positions as SerializedPosition[]).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase text-gray-500">
                          <th className="px-3 py-2">ISIN</th>
                          <th className="px-3 py-2">Producto</th>
                          <th className="px-3 py-2 text-right">Titulos</th>
                          <th className="px-3 py-2 text-right">Coste Medio</th>
                          <th className="px-3 py-2 text-right">Precio</th>
                          <th className="px-3 py-2 text-right">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(result.data.positions as SerializedPosition[]).map(
                          (pos, i) => (
                            <tr
                              key={`${pos.isin}-${i}`}
                              className="border-b last:border-0 hover:bg-gray-50"
                            >
                              <td className="px-3 py-2 font-mono text-xs">{pos.isin}</td>
                              <td className="max-w-[200px] truncate px-3 py-2">
                                {pos.productName}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {pos.shares.toLocaleString("es-ES", { maximumFractionDigits: 4 })}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {formatEur(pos.avgCost)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {formatEur(pos.marketPrice)}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold">
                                {formatEur(pos.totalValue)}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Operations Table */}
            {(result.data.operations as SerializedOperation[]).length > 0 && (
              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#1e3a8a]">
                    <FileSpreadsheet className="h-4 w-4" />
                    Operaciones ({(result.data.operations as SerializedOperation[]).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase text-gray-500">
                          <th className="px-3 py-2">Fecha</th>
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2">ISIN</th>
                          <th className="px-3 py-2">Nombre</th>
                          <th className="px-3 py-2 text-right">Importe</th>
                          <th className="px-3 py-2 text-right">Titulos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(result.data.operations as SerializedOperation[]).map(
                          (op, i) => (
                            <tr
                              key={`${op.isin}-${op.date}-${i}`}
                              className="border-b last:border-0 hover:bg-gray-50"
                            >
                              <td className="px-3 py-2 text-xs">{formatDate(op.date)}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                                    op.type === "Compra" || op.type === "Aportacion"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {op.type}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">{op.isin}</td>
                              <td className="max-w-[200px] truncate px-3 py-2">{op.name}</td>
                              <td className="px-3 py-2 text-right">{formatEur(op.amount)}</td>
                              <td className="px-3 py-2 text-right">
                                {op.shares.toLocaleString("es-ES", { maximumFractionDigits: 4 })}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Liquidity Table */}
            {(result.data.liquidity as SerializedLiquidity[]).length > 0 && (
              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#1e3a8a]">
                    <FileSpreadsheet className="h-4 w-4" />
                    Liquidez ({(result.data.liquidity as SerializedLiquidity[]).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase text-gray-500">
                          <th className="px-3 py-2">Fecha</th>
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2 text-right">Importe</th>
                          <th className="px-3 py-2 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(result.data.liquidity as SerializedLiquidity[]).map(
                          (liq, i) => (
                            <tr
                              key={`${liq.date}-${i}`}
                              className="border-b last:border-0 hover:bg-gray-50"
                            >
                              <td className="px-3 py-2 text-xs">{formatDate(liq.date)}</td>
                              <td className="px-3 py-2">{liq.type}</td>
                              <td
                                className={`px-3 py-2 text-right ${
                                  liq.amount >= 0 ? "text-green-700" : "text-red-700"
                                }`}
                              >
                                {formatEur(liq.amount)}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold">
                                {formatEur(liq.balance)}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigate to Dashboard */}
            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={() => router.push("/dashboard")}
                className="gap-2"
              >
                Ver Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ===========================================================================
// Subcomponentes y helpers
// ===========================================================================

function StatBlock({
  label,
  valid,
  total,
  skipped,
}: {
  label: string;
  valid: number;
  total: number;
  skipped: number;
}) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#1e3a8a]">{valid}</p>
      <p className="mt-1 text-xs text-gray-400">
        {total} filas totales, {skipped} descartadas
      </p>
    </div>
  );
}

function formatEur(value: number): string {
  return value.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}
