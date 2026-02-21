"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getUploadedData, clearUploadedData } from "@/lib/utils/storage";
import type { UploadedData } from "@/lib/utils/storage";
import {
  Wallet,
  BarChart3,
  TrendingUp,
  Clock,
  Upload,
  Trash2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface KpiCard {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  valueClassName?: string;
}

// ---------------------------------------------------------------------------
// KPIs placeholder (sin datos)
// ---------------------------------------------------------------------------

const PLACEHOLDER_KPIS: KpiCard[] = [
  {
    title: "Valor Total Portfolio",
    value: "---",
    description: "Sube archivos Excel para ver datos reales",
    icon: Wallet,
    valueClassName: "text-gray-300",
  },
  {
    title: "Posiciones",
    value: "---",
    description: "Sin datos cargados",
    icon: BarChart3,
    valueClassName: "text-gray-300",
  },
  {
    title: "TWR (Rentabilidad)",
    value: "---",
    description: "Sin datos cargados",
    icon: TrendingUp,
    valueClassName: "text-gray-300",
  },
  {
    title: "Ultima Actualizacion",
    value: "---",
    description: "Sin datos cargados",
    icon: Clock,
    valueClassName: "text-gray-300",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEur(value: number): string {
  return value.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

function computeKpis(data: UploadedData): KpiCard[] {
  const positions = data.positions;
  const positionCount = positions.length;

  // Valor total: suma de totalValue
  const totalValue = positions.reduce((sum, p) => sum + p.totalValue, 0);

  // TWR simple: ((valorMercado - costeTotal) / costeTotal) * 100
  const totalCost = positions.reduce(
    (sum, p) => sum + p.avgCost * p.shares,
    0
  );
  const twr = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
  const twrSign = twr >= 0 ? "+" : "";

  // Fecha de actualizacion
  const uploadDate = formatDate(data.uploadedAt);

  return [
    {
      title: "Valor Total Portfolio",
      value: formatEur(totalValue),
      description: "Valor de mercado actual",
      icon: Wallet,
      valueClassName: "text-[#1e3a8a]",
    },
    {
      title: "Posiciones",
      value: String(positionCount),
      description: "Activos en cartera",
      icon: BarChart3,
      valueClassName: "text-[#1e3a8a]",
    },
    {
      title: "TWR (Rentabilidad)",
      value: `${twrSign}${twr.toFixed(2)}%`,
      description: "Time-Weighted Return",
      icon: TrendingUp,
      valueClassName: twr >= 0 ? "text-green-600" : "text-red-600",
    },
    {
      title: "Ultima Actualizacion",
      value: uploadDate,
      description: "Datos actualizados",
      icon: Clock,
      valueClassName: "text-[#1e3a8a]",
    },
  ];
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();
  const [kpis, setKpis] = useState<KpiCard[]>(PLACEHOLDER_KPIS);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    const data = getUploadedData();
    if (data && data.positions.length > 0) {
      setKpis(computeKpis(data));
      setHasData(true);
    }
  }, []);

  const handleClearData = () => {
    clearUploadedData();
    setKpis(PLACEHOLDER_KPIS);
    setHasData(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-10">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1e3a8a]">
            Dashboard Patrimonial Rowell
          </h1>
          <p className="mt-1 text-gray-500">
            Resumen de tu cartera de inversion
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/upload")}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {hasData ? "Actualizar Datos" : "Cargar Excel"}
          </Button>
          {hasData && (
            <Button
              variant="ghost"
              onClick={handleClearData}
              className="gap-2 text-gray-500 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              Limpiar
            </Button>
          )}
        </div>
      </header>

      {/* No data banner */}
      {!hasData && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No hay datos cargados. Sube los archivos Excel de Mapfre para ver tus
          KPIs reales.
        </div>
      )}

      {/* KPI Grid */}
      <section
        aria-label="Indicadores clave del portfolio"
        className="grid grid-cols-1 gap-6 md:grid-cols-2"
      >
        {kpis.map((kpi) => {
          const Icon = kpi.icon;

          return (
            <Card
              key={kpi.title}
              className="border bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  {kpi.title}
                </CardTitle>
                <Icon className="h-5 w-5 text-[#d4af37]" aria-hidden="true" />
              </CardHeader>

              <CardContent>
                <p
                  className={`text-3xl font-bold tracking-tight ${kpi.valueClassName ?? "text-[#1e3a8a]"}`}
                >
                  {kpi.value}
                </p>
                <p className="mt-1 text-xs text-gray-400">{kpi.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
