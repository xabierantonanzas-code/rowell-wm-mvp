"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks/useUser";
import ExcelUpload from "@/components/upload/ExcelUpload";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";

export default function UploadPage() {
  const router = useRouter();
  const { isAdmin, loading } = useUser();
  const [result, setResult] = useState<{
    success: boolean;
    inserted?: {
      positions: number;
      operations: number;
      balances: number;
      newAccounts: number;
    };
    stats?: Record<string, { totalRows: number; validRows: number; skippedRows: number }>;
    error?: string;
  } | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400">Cargando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-rowell-navy">
            Upload
          </h1>
        </div>
        <Card className="border bg-white shadow-sm">
          <CardContent className="flex items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-6 w-6 text-amber-500" />
            <p className="text-gray-500">
              Solo el administrador puede subir archivos.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-rowell-navy">
          Cargar Datos Excel
        </h1>
        <p className="mt-1 text-gray-500">
          Sube los archivos Excel de Mapfre para actualizar las carteras
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-8">
        {/* Upload Component */}
        <ExcelUpload onUploadComplete={(r) => setResult(r)} />

        {/* Results */}
        {result?.success && result.inserted && (
          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rowell-navy">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Datos cargados correctamente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatBlock
                  label="Posiciones"
                  value={result.inserted.positions}
                />
                <StatBlock
                  label="Operaciones"
                  value={result.inserted.operations}
                />
                <StatBlock
                  label="Saldos"
                  value={result.inserted.balances}
                />
                <StatBlock
                  label="Cuentas nuevas"
                  value={result.inserted.newAccounts}
                />
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  size="lg"
                  onClick={() => router.push("/admin")}
                  className="gap-2"
                >
                  Ver Panel Admin
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {result && !result.success && (
          <Card className="border border-red-200 bg-red-50 shadow-sm">
            <CardContent className="py-4 text-sm text-red-700">
              {result.error ?? "Error desconocido al procesar los archivos."}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3 text-center">
      <p className="text-2xl font-bold text-rowell-navy">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{label}</p>
    </div>
  );
}
