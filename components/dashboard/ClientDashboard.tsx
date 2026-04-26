"use client";

import { useState, useMemo, useRef } from "react";
import type { Position, Operation } from "@/lib/types/database";
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  PieChart as PieChartIcon,
  Target,
  User,
} from "lucide-react";
import PositionsTable from "@/components/dashboard/PositionsTable";
import CommunicationPanel from "@/components/dashboard/CommunicationPanel";
import CombinedChart from "@/components/dashboard/CombinedChart";
import StrategyChart from "@/components/dashboard/StrategyChart";
import DataIntegrityAlert from "@/components/ui/DataIntegrityAlert";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  classifyFlow,
  flowAmountEur,
  isPlus,
  isMinus,
} from "@/lib/operations-taxonomy";
import { computeEurCostByIsin } from "@/lib/eur-cost-fifo";
import { classifyProduct } from "@/lib/product-type";
import { buildProductTypeMap, resolveProductType } from "@/lib/product-type-from-ops";
import { useTheme } from "@/components/theme/ThemeContext";
import { AnimatedValue } from "@/components/ui/AnimatedValue";
import { cn } from "@/lib/utils";

// ===========================================================================
// Types
// ===========================================================================

interface AccountOption {
  id: string;
  account_number: string;
  label: string | null;
}

interface HistoryPoint {
  date: string;
  totalValue: number;
}

interface OperationsData {
  operations: Operation[];
  total: number;
  page: number;
  totalPages: number;
}

interface HistoryByAccount {
  [accountId: string]: { date: string; totalValue: number }[];
}

interface DashboardData {
  accountId: string;
  dateFrom: string | null;
  dateTo: string | null;
  positions: Position[];
  history: HistoryPoint[];
  historyByAccount?: HistoryByAccount;
  operations: OperationsData;
  cashBalance: number;
}

interface ClientDashboardProps {
  clientName: string;
  clientId?: string;
  accounts: AccountOption[];
  availableDateRange: { minDate: string; maxDate: string } | null;
  initialData: DashboardData;
  fetchUrl: string;
  showBackLink?: boolean;
  backHref?: string;
  isAdmin?: boolean;
}

// ===========================================================================
// Constants
// ===========================================================================

const NAVY = "#3D4F63";
const GOLD = "#B8965A";
const LIGHT_BG = "#F5F5F5";

const PIE_COLORS = [
  "#3D4F63", "#B8965A", "#2563eb", "#059669", "#d97706",
  "#7c3aed", "#dc2626", "#0891b2", "#4f46e5", "#db2777",
];

// ===========================================================================
// Helpers
// ===========================================================================

function formatEur(value: number): string {
  return value.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatEur2(value: number): string {
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

/**
 * MIN(operation_date) sobre las operaciones. Funcion pura, sin side
 * effects. Si el array viene vacio o todas las dates son null, devuelve
 * null — el consumidor decide el fallback (today, undefined, etc.).
 *
 * Usada en dos sitios dentro de ClientDashboard:
 *   1. useState initializer de dateFrom (primer render, arranque en Origen).
 *   2. useMemo de originDate (para el boton "Desde origen" de DateRangeBar).
 * Mismo input (array completo de ops), mismo resultado, cero duplicacion.
 */
function computeOriginDate(ops: Operation[]): string | null {
  let earliest: string | null = null;
  for (const op of ops) {
    const d = op.operation_date;
    if (!d) continue;
    if (!earliest || d < earliest) earliest = d;
  }
  return earliest;
}

// ===========================================================================
// DateRangeBar - selector de fechas + botones de periodo (Edgard MVP6 #3+#4)
// ===========================================================================
//
// Fix iOS Safari: el truco anterior usaba type="text" y cambiaba a "date"
// onFocus, lo cual rompe el picker nativo en iOS Safari y no muestra
// "Desde"/"Hasta" como label real. Aqui usamos siempre type="date" + un
// label flotante encima cuando esta vacio, y abrimos el picker
// programaticamente con showPicker() en click.

interface DateRangeBarProps {
  dateFrom?: string;
  dateTo?: string;
  onChange: (from: string | undefined, to: string | undefined) => void;
  minDate?: string;
  maxDate?: string;
  /** Fecha de la 1a operacion registrada para esta CV (YYYY-MM-DD). */
  originDate?: string | null;
}

function DateRangeBar({
  dateFrom,
  dateTo,
  onChange,
  minDate,
  maxDate,
  originDate,
}: DateRangeBarProps) {
  const { themeName } = useTheme();
  const isModern = themeName === "modern";
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  const todayIso = () => new Date().toISOString().split("T")[0];
  const minusDays = (d: number) => {
    const x = new Date();
    x.setDate(x.getDate() - d);
    return x.toISOString().split("T")[0];
  };
  const ytdIso = () => `${new Date().getFullYear()}-01-01`;

  const periods = useMemo(
    () => [
      { label: "1M", from: minusDays(30), to: todayIso() },
      { label: "YTD", from: ytdIso(), to: todayIso() },
      { label: "1A", from: minusDays(365), to: todayIso() },
      ...(originDate
        ? [{ label: "Origen", from: originDate, to: todayIso() }]
        : []),
    ],
    [originDate]
  );

  const activeLabel = useMemo(() => {
    if (!dateFrom && !dateTo) return null;
    return periods.find((p) => p.from === dateFrom && p.to === dateTo)?.label ?? null;
  }, [dateFrom, dateTo, periods]);

  const openPicker = (ref: React.RefObject<HTMLInputElement>) => {
    const el = ref.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        /* fall through */
      }
    }
    el.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Calendar className={cn("h-4 w-4 flex-shrink-0", isModern ? "text-gray-400" : "text-white/40")} />
      {/* Botones de periodo */}
      <div className="flex flex-wrap items-center gap-1">
        {periods.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.from, p.to)}
            className={cn(
              "rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
              activeLabel === p.label
                ? isModern
                  ? "border-[var(--color-gold)] bg-[var(--color-gold)] text-white"
                  : "border-[var(--color-gold)] bg-[var(--color-gold)] text-[var(--color-primary)]"
                : isModern
                  ? "border-gray-300 bg-gray-100 text-gray-600 hover:border-[var(--color-gold)] hover:text-gray-900"
                  : "border-white/20 bg-white/10 text-white/80 hover:border-[var(--color-gold)] hover:text-white"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {/* Inputs nativos */}
      <div className="relative flex flex-wrap items-center gap-1.5">
        <div className="relative">
          <span className={cn(
            "pointer-events-none absolute -top-2 left-2 z-10 rounded px-1 text-[9px] font-medium",
            isModern ? "bg-white text-gray-400" : "bg-[var(--color-primary)] text-white/60"
          )}>
            Desde
          </span>
          <input
            ref={fromRef}
            type="date"
            value={dateFrom ?? ""}
            min={minDate}
            max={dateTo || maxDate}
            onChange={(e) => onChange(e.target.value || undefined, dateTo)}
            onClick={() => openPicker(fromRef)}
            className={cn(
              "min-w-[140px] cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium focus:border-[var(--color-gold)] focus:outline-none sm:py-1.5",
              isModern
                ? "border-gray-300 bg-white text-gray-800"
                : "border-white/20 bg-white/10 text-white backdrop-blur-sm [color-scheme:dark]"
            )}
            aria-label="Fecha desde"
          />
        </div>
        <span className={cn("text-xs", isModern ? "text-gray-400" : "text-white/40")}>—</span>
        <div className="relative">
          <span className={cn(
            "pointer-events-none absolute -top-2 left-2 z-10 rounded px-1 text-[9px] font-medium",
            isModern ? "bg-white text-gray-400" : "bg-[var(--color-primary)] text-white/60"
          )}>
            Hasta
          </span>
          <input
            ref={toRef}
            type="date"
            value={dateTo ?? ""}
            min={dateFrom || minDate}
            max={maxDate}
            onChange={(e) => onChange(dateFrom, e.target.value || undefined)}
            onClick={() => openPicker(toRef)}
            className={cn(
              "min-w-[140px] cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium focus:border-[var(--color-gold)] focus:outline-none sm:py-1.5",
              isModern
                ? "border-gray-300 bg-white text-gray-800"
                : "border-white/20 bg-white/10 text-white backdrop-blur-sm [color-scheme:dark]"
            )}
            aria-label="Fecha hasta"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => onChange(undefined, undefined)}
            className={cn(
              "rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:py-1.5",
              isModern
                ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            )}
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}

function getOpIcon(type: string | null) {
  const cat = classifyFlow(type ?? "");
  if (cat === "plus")
    return <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" />;
  if (cat === "minus")
    return <ArrowUpRight className="h-3.5 w-3.5 text-red-600" />;
  return <RefreshCw className="h-3.5 w-3.5 text-blue-500" />;
}

function getOpColor(type: string | null): string {
  const cat = classifyFlow(type ?? "");
  if (cat === "plus") return "text-green-600";
  if (cat === "minus") return "text-red-600";
  return "text-blue-600";
}

// ===========================================================================
// Sub-components: Section header (replica del estilo del informe)
// ===========================================================================

function SectionHeader({
  number,
  title,
  collapsible,
  open,
  onToggle,
}: {
  number: string;
  title: string;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const { themeName } = useTheme();
  const isModern = themeName === "modern";

  const content = (
    <>
      <span>{number}. {title}</span>
      {collapsible && (
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      )}
    </>
  );

  if (collapsible) {
    return (
      <div className="relative mb-4 mt-2 sm:mb-6">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-between"
        >
          {isModern ? (
            <h2 className="flex w-full items-center justify-between border-l-4 border-[var(--color-gold)] px-4 py-2.5 text-sm font-bold text-gray-900 sm:px-6 sm:py-3 sm:text-lg">
              {content}
            </h2>
          ) : (
            <h2 className="relative flex w-full items-center justify-between rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-2.5 font-display text-sm font-bold text-white sm:px-6 sm:py-3 sm:text-lg">
              {content}
            </h2>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="relative mb-4 mt-2 sm:mb-6">
      {isModern ? (
        <h2 className="border-l-4 border-[var(--color-gold)] px-4 py-2.5 text-sm font-bold text-gray-900 sm:px-6 sm:py-3 sm:text-lg">
          {number}. {title}
        </h2>
      ) : (
        <>
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] opacity-90" />
          <h2 className="relative px-4 py-2.5 font-display text-sm font-bold text-white sm:px-6 sm:py-3 sm:text-lg">
            {number}. {title}
          </h2>
        </>
      )}
    </div>
  );
}

function SectionDivider() {
  return <div className="my-5 h-px bg-gradient-to-r from-transparent via-[var(--color-gold-40)] to-transparent sm:my-8" />;
}

// ===========================================================================
// Sub-component: Investor Profile Card
// ===========================================================================

function InvestorProfileCard({
  totalValue,
  totalCost,
  pnl,
  fundCount,
  cashBalance,
  netContributions,
  latestDate,
  positions,
}: {
  /** Valor de cartera (suma de positions, NO incluye saldo). */
  totalValue: number;
  /** Coste medio total (units * avg_cost en divisa original convertido). */
  totalCost: number;
  /** Plusvalía % calculada sobre coste medio (NO incluye efecto divisa). */
  pnl: number;
  fundCount: number;
  /** Saldo de cuenta de efectivo. */
  cashBalance: number;
  /** Aportaciones netas reales: SUM(PLUS) - SUM(MINUS) sobre operations.
   *  Es lo que Edgard llama "Patrimonio invertido". */
  netContributions: number;
  latestDate: string;
  positions: Position[];
}) {
  // MVP6 Edgard #6: arreglos al tile.
  // - patrimonioTotal = valor_cartera + saldo (antes mostraba solo cartera)
  // - patrimonioInvertido = aportaciones netas reales (PLUS-MINUS),
  //   no "totalValue - cashBalance" como se calculaba mal antes
  // - rentabilidad acumulada = valor_cartera - patrimonio_invertido
  //   (Edgard punto 6: 70.675€ = 24,29% para Aurum-077)
  // - %Efectivo = saldo / patrimonio_total
  const patrimonioTotal = totalValue + cashBalance;
  const cashPct = patrimonioTotal > 0 ? (cashBalance / patrimonioTotal) * 100 : 0;
  const rentabilidadAcumEur = totalValue - netContributions;
  const rentabilidadAcumPct =
    netContributions > 0 ? (rentabilidadAcumEur / netContributions) * 100 : 0;
  const rentabPositive = rentabilidadAcumEur >= 0;
  const isinCount = new Set(positions.map((p) => p.isin).filter(Boolean)).size;

  const kpis: {
    label: string;
    rawValue: number;
    format: (v: number) => string;
    prefix?: string;
    sub: string;
    accent: boolean;
    positive?: boolean;
  }[] = [
    {
      label: "Patrimonio total",
      rawValue: patrimonioTotal,
      format: formatEur,
      sub: `Cartera + efectivo`,
      accent: false,
    },
    {
      label: "Valor cartera",
      rawValue: totalValue,
      format: formatEur,
      sub: `${fundCount} posiciones`,
      accent: false,
    },
    {
      label: "Efectivo disponible",
      rawValue: cashBalance,
      format: formatEur,
      sub: "Liquidez",
      accent: false,
    },
    {
      label: "% Efectivo",
      rawValue: cashPct,
      format: (v) => `${v.toFixed(1)}%`,
      sub: "Sobre patrimonio total",
      accent: false,
    },
    {
      label: "Patrimonio invertido",
      rawValue: netContributions,
      format: formatEur,
      sub: "Aportaciones netas reales",
      accent: false,
    },
    {
      label: "Rentabilidad acumulada",
      rawValue: rentabilidadAcumEur,
      format: formatEur,
      prefix: rentabPositive ? "+" : "",
      sub: `${rentabPositive ? "+" : ""}${rentabilidadAcumPct.toFixed(2)}% sobre invertido`,
      accent: true,
      positive: rentabPositive,
    },
    {
      label: "N° fondos",
      rawValue: fundCount,
      format: (v) => String(Math.round(v)),
      sub: latestDate,
      accent: false,
    },
    {
      label: "N° ISINs",
      rawValue: isinCount,
      format: (v) => String(Math.round(v)),
      sub: `${isinCount} instrumentos unicos`,
      accent: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
      {kpis.map((kpi, i) => (
        <div
          key={kpi.label}
          className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-gold-soft)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-400 sm:mb-2 sm:text-xs">
            {kpi.label}
          </p>
          <p
            className={`font-display text-lg font-bold sm:text-2xl ${
              kpi.accent
                ? kpi.positive
                  ? "text-green-600"
                  : "text-red-600"
                : "text-[var(--color-primary)]"
            }`}
          >
            <AnimatedValue
              value={kpi.rawValue}
              format={kpi.format}
              prefix={kpi.prefix}
            />
          </p>
          <p className="mt-0.5 text-[10px] text-gray-400 sm:mt-1 sm:text-xs">{kpi.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// Sub-component: Top Holdings
// ===========================================================================

function TopHoldings({ positions }: { positions: Position[] }) {
  if (positions.length === 0) return null;

  const totalValue = positions.reduce((s, p) => s + (p.position_value ?? 0), 0);
  const top = [...positions]
    .sort((a, b) => (b.position_value ?? 0) - (a.position_value ?? 0))
    .slice(0, 10);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
          <Target className="h-4 w-4 text-[var(--color-gold)]" />
          Top 10 Posiciones
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-[var(--color-table-header-bg)] text-xs uppercase text-[var(--color-table-header-text)]">
              <th className="px-4 py-2.5 font-medium">Producto</th>
              <th className="px-4 py-2.5 font-medium">Gestora</th>
              <th className="px-4 py-2.5 text-right font-medium">Valor</th>
              <th className="px-4 py-2.5 text-right font-medium">Peso</th>
              <th className="px-4 py-2.5 text-right font-medium">P&L %</th>
            </tr>
          </thead>
          <tbody>
            {top.map((pos, idx) => {
              const cost = (pos.units ?? 0) * (pos.avg_cost ?? 0);
              const pnl = (pos.position_value ?? 0) - cost;
              const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
              const weight = totalValue > 0
                ? ((pos.position_value ?? 0) / totalValue) * 100
                : 0;

              return (
                <tr
                  key={pos.id}
                  className={`border-b border-gray-100 last:border-0 transition-colors hover:bg-[var(--color-bg)] ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                  }`}
                >
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-xs font-semibold text-[var(--color-primary)]">
                    {pos.product_name}
                  </td>
                  <td className="max-w-[120px] truncate px-4 py-2.5 text-xs text-gray-500">
                    {pos.manager ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-[var(--color-primary)]">
                    {formatEur(pos.position_value ?? 0)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs tabular-nums text-gray-500">
                        {weight.toFixed(1)}%
                      </span>
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-[var(--color-gold)] transition-all duration-500"
                          style={{ width: `${Math.min(weight, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right text-xs font-semibold ${
                      pnl >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-component: Asset Distribution (like page 5 of informe)
// ===========================================================================

function AssetDistribution({
  positions,
  cashBalance = 0,
  productTypeMap,
}: {
  positions: Position[];
  cashBalance?: number;
  productTypeMap: Map<string, "iic" | "rv">;
}) {
  if (positions.length === 0 && cashBalance === 0) return null;

  // Agrupar por tipo de activo: Acciones (RV), Fondos (IIC), Efectivo, Otro
  let rvValue = 0;
  let iicValue = 0;
  for (const pos of positions) {
    const t = resolveProductType(pos.isin, pos.product_name, productTypeMap);
    if (t === "rv") rvValue += pos.position_value ?? 0;
    else iicValue += pos.position_value ?? 0;
  }

  const assetData = [
    { name: "Fondos (IIC)", value: iicValue },
    { name: "Acciones / ETFs", value: rvValue },
    { name: "Efectivo", value: cashBalance },
  ].filter((d) => d.value > 0);

  // Agrupar por moneda
  const byCurrency = new Map<string, number>();
  for (const pos of positions) {
    const currency = pos.currency || "EUR";
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + (pos.position_value ?? 0));
  }
  if (cashBalance > 0) {
    byCurrency.set("EUR", (byCurrency.get("EUR") ?? 0) + cashBalance);
  }
  const currencyData = Array.from(byCurrency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  const totalValue = positions.reduce((s, p) => s + (p.position_value ?? 0), 0) + cashBalance;

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
      {/* Por Tipo de Activo */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)] sm:mb-4 sm:text-sm">
          <PieChartIcon className="h-4 w-4 text-[var(--color-gold)]" />
          Distribucion por Tipo de Activo
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-1/2">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={assetData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {assetData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [formatEur(v), "Valor"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-1/2 space-y-1.5">
            {assetData.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <div
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="flex-1 truncate text-gray-600">{item.name}</span>
                <span className="font-medium text-gray-800">
                  {totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : "0.0"}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Por Moneda */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)] sm:mb-4 sm:text-sm">
          <Target className="h-4 w-4 text-[var(--color-gold)]" />
          Distribucion por Moneda
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-1/2">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={currencyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {currencyData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [formatEur(v), "Valor"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-1/2 space-y-2">
            {currencyData.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <div
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="flex-1 text-gray-600">{item.name}</span>
                <span className="font-semibold text-gray-800">{formatEur(item.value)}</span>
                <span className="text-gray-400">
                  ({totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : "0.0"}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-component: Portfolio Table (estilo informe page 6)
// ===========================================================================

function PortfolioTable({ positions }: { positions: Position[] }) {
  if (positions.length === 0) return null;

  const totalValue = positions.reduce((s, p) => s + (p.position_value ?? 0), 0);
  const totalCost = positions.reduce((s, p) => s + (p.units ?? 0) * (p.avg_cost ?? 0), 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-[var(--color-table-header-bg)] text-xs uppercase text-[var(--color-table-header-text)]">
              <th className="px-3 py-2.5 font-medium">Producto</th>
              <th className="px-3 py-2.5 font-medium">ISIN</th>
              <th className="px-3 py-2.5 font-medium">Gestora</th>
              <th className="px-3 py-2.5 text-right font-medium">Titulos</th>
              <th className="px-3 py-2.5 text-right font-medium">Coste</th>
              <th className="px-3 py-2.5 text-right font-medium">Precio</th>
              <th className="px-3 py-2.5 text-right font-medium">P&L</th>
              <th className="px-3 py-2.5 text-right font-medium">Valor</th>
              <th className="px-3 py-2.5 text-right font-medium">% Cart.</th>
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
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  } hover:bg-[var(--color-bg)]`}
                >
                  <td className="max-w-[180px] truncate px-3 py-2 text-xs font-medium text-gray-800">
                    {pos.product_name}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-gray-400">
                    {pos.isin}
                  </td>
                  <td className="max-w-[120px] truncate px-3 py-2 text-xs text-gray-500">
                    {pos.manager ?? "\u2014"}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {(pos.units ?? 0).toLocaleString("es-ES", { maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-gray-600">
                    {formatEur2(pos.avg_cost ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-gray-600">
                    {formatEur2(pos.market_price ?? 0)}
                  </td>
                  <td className={`px-3 py-2 text-right text-xs font-semibold ${
                    pnl >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-[var(--color-primary)]">
                    {formatEur(pos.position_value ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-gray-500">
                    {weight.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--color-gold)] bg-[var(--color-bg)]">
              <td colSpan={6} className="px-3 py-2.5 text-right text-xs font-bold uppercase text-[var(--color-primary)]">
                Total
              </td>
              <td className={`px-3 py-2.5 text-right text-xs font-bold ${
                totalValue - totalCost >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {totalCost > 0
                  ? `${totalValue - totalCost >= 0 ? "+" : ""}${(((totalValue - totalCost) / totalCost) * 100).toFixed(2)}%`
                  : "\u2014"}
              </td>
              <td className="px-3 py-2.5 text-right text-xs font-bold text-[var(--color-primary)]">
                {formatEur(totalValue)}
              </td>
              <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-500">
                100%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ===========================================================================
// Main Component
// ===========================================================================

export default function ClientDashboard({
  clientName,
  clientId,
  accounts,
  availableDateRange,
  initialData,
  fetchUrl,
  showBackLink,
  backHref,
  isAdmin = false,
}: ClientDashboardProps) {
  const { themeName, colors } = useTheme();
  const isModern = themeName === "modern";
  const [selectedAccountId, setSelectedAccountId] = useState<string | "all">(
    accounts.length === 1 ? accounts[0].id : "all"
  );
  // MVP6 final #2: arrancar con Origen -> hoy para que el grafico no salga
  // vacio en la primera carga. Si la URL trae dateFrom/dateTo, respetarlos.
  // Si el cliente no tiene operaciones, fallback a hoy/hoy.
  const [dateFrom, setDateFrom] = useState<string | undefined>(() => {
    if (initialData.dateFrom) return initialData.dateFrom;
    const origin = computeOriginDate(initialData.operations.operations);
    return origin ?? new Date().toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState<string | undefined>(
    () => initialData.dateTo ?? new Date().toISOString().split("T")[0]
  );
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"cartera" | "operaciones">("cartera");
  const [opsPage, setOpsPage] = useState(1);
  const [returnMethod, setReturnMethod] = useState<"twr" | "mwr">("twr");
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    "2": true,  // Evolucion Patrimonial
    "3": true,  // Distribucion de Activos
    "4": false, // Posiciones (collapsed by default)
    "5": true,  // Cartera / Operaciones
    "6": true,  // Espacio Personal
  });
  const toggleSection = (key: string) =>
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  // Fetch data
  const fetchData = async (
    accountId: string | "all",
    df: string | undefined,
    dt: string | undefined,
    page: number = 1
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (accountId !== "all") params.set("account", accountId);
      if (df) params.set("dateFrom", df);
      if (dt) params.set("dateTo", dt);
      params.set("page", String(page));

      // Multi-account
      if (accountId === "all" && accounts.length > 1) {
        params.set("accounts", JSON.stringify(accounts.map((a) => a.id)));
      } else if (accountId === "all" && accounts.length === 1) {
        params.set("account", accounts[0].id);
      }

      const res = await fetch(`${fetchUrl}?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const newData = await res.json();
      setData(newData);
      setOpsPage(page);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (newDateFrom: string | undefined, newDateTo: string | undefined) => {
    setDateFrom(newDateFrom);
    setDateTo(newDateTo);
    fetchData(selectedAccountId, newDateFrom, newDateTo);
  };

  const handleAccountChange = (accountId: string | "all") => {
    setSelectedAccountId(accountId);
    fetchData(accountId, dateFrom, dateTo);
  };

  const handlePageChange = (page: number) => {
    fetchData(selectedAccountId, dateFrom, dateTo, page);
  };

  // Computed values
  const totalValue = useMemo(
    () => data.positions.reduce((sum, p) => sum + (p.position_value ?? 0), 0),
    [data.positions]
  );
  const totalCost = useMemo(
    () => data.positions.reduce((sum, p) => sum + (p.units ?? 0) * (p.avg_cost ?? 0), 0),
    [data.positions]
  );
  const pnl = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
  const latestDate = useMemo(() => {
    if (data.positions.length === 0) return "Sin datos";
    return new Date(data.positions[0].snapshot_date).toLocaleDateString("es-ES", {
      day: "numeric", month: "long", year: "numeric",
    });
  }, [data.positions]);

  // FIFO de coste EUR por ISIN -> permite mostrar P&L con efecto divisa real
  // en PositionsTable. Reconstruye el coste de las posiciones actuales a
  // partir del Registro de Operaciones (PLUS = compras, MINUS = ventas).
  const eurCostMap = useMemo(
    () => computeEurCostByIsin(data.operations.operations),
    [data.operations.operations]
  );

  // Map ISIN -> tipo de producto (iic | rv) deducido de operation_type de
  // la primera compra. Fuente fiable confirmada por Edgard MVP6 #2b.
  const productTypeMap = useMemo(
    () => buildProductTypeMap(data.operations.operations),
    [data.operations.operations]
  );

  // Fecha de la 1a operacion registrada para esta CV (Edgard MVP6 #4:
  // boton "Desde origen" = primera operacion de la cuenta).
  // Usa el mismo helper que el useState initializer de dateFrom.
  const originDate = useMemo(
    () => computeOriginDate(data.operations.operations),
    [data.operations.operations]
  );

  // Aportaciones netas y comisiones (taxonomia oficial Edgard MVP6)
  // PLUS  = CONTRAVALOR EFECTIVO NETO (eur_amount)
  // MINUS = EFECTIVO BRUTO * CAMBIO DIVISA (gross_amount * fx_rate)
  // NEUTRO = ignorar
  const { netContributions, totalContributions, totalWithdrawals, totalCommissions, totalRetentions } = useMemo(() => {
    let contributions = 0, withdrawals = 0, commissions = 0, retentions = 0;
    for (const op of data.operations.operations) {
      const signed = flowAmountEur(op);
      if (signed > 0) contributions += signed;
      else if (signed < 0) withdrawals += Math.abs(signed);
      commissions += op.commission ?? 0;
      retentions += op.withholding ?? 0;
    }
    return {
      netContributions: contributions - withdrawals,
      totalContributions: contributions,
      totalWithdrawals: withdrawals,
      totalCommissions: commissions,
      totalRetentions: retentions,
    };
  }, [data.operations.operations]);

  // Plusvalía total económica = patrimonio actual - aportaciones netas
  const plusvaliaTotalEco = totalValue - netContributions;

  // Concentration top 5 / top 10
  const { concTop5, concTop10 } = useMemo(() => {
    if (data.positions.length === 0 || totalValue === 0) return { concTop5: 0, concTop10: 0 };
    const sorted = [...data.positions].sort((a, b) => (b.position_value ?? 0) - (a.position_value ?? 0));
    const top5 = sorted.slice(0, 5).reduce((s, p) => s + (p.position_value ?? 0), 0);
    const top10 = sorted.slice(0, 10).reduce((s, p) => s + (p.position_value ?? 0), 0);
    return {
      concTop5: (top5 / totalValue) * 100,
      concTop10: (top10 / totalValue) * 100,
    };
  }, [data.positions, totalValue]);

  // Rentabilidad por periodos — TWR (Time Weighted Return)
  const twrPeriods = useMemo(() => {
    if (data.history.length === 0 || totalValue === 0) return [];
    const now = new Date();
    const periods = [
      { label: "1M", daysAgo: 30 },
      { label: "3M", daysAgo: 90 },
      { label: "YTD", yearStart: true as const },
      { label: "1A", daysAgo: 365 },
      { label: "ALL", daysAgo: undefined as number | undefined },
    ];

    return periods.map((p) => {
      let targetDate: string;
      if (p.label === "ALL") {
        targetDate = data.history[0].date;
      } else if ("yearStart" in p && p.yearStart) {
        targetDate = `${now.getFullYear()}-01-01`;
      } else {
        const d = new Date(now);
        d.setDate(d.getDate() - (p.daysAgo ?? 0));
        targetDate = d.toISOString().split("T")[0];
      }
      const closest = data.history.find((h) => h.date >= targetDate) ?? data.history[0];
      const startValue = closest.totalValue;
      if (startValue > 0) {
        const returnEur = totalValue - startValue;
        const returnPct = (returnEur / startValue) * 100;
        return { period: p.label, returnPct, returnEur };
      }
      return { period: p.label, returnPct: 0, returnEur: 0 };
    });
  }, [data.history, totalValue]);

  // Rentabilidad por periodos — MWR (Money Weighted Return / Modified Dietz)
  // Solo flujos PLUS y MINUS reales segun taxonomia oficial (Edgard MVP6).
  // Los traspasos internos, fusiones y splits son NEUTROS y se descartan.
  const mwrPeriods = useMemo(() => {
    if (data.history.length === 0 || totalValue === 0) return [];

    // Build sorted cashflows from operations (only real external flows)
    const cashflows: { date: string; amount: number }[] = [];
    for (const op of data.operations.operations) {
      if (!op.operation_date || !op.operation_type) continue;
      const signed = flowAmountEur(op);
      if (signed === 0) continue;
      cashflows.push({ date: op.operation_date, amount: signed });
    }
    cashflows.sort((a, b) => a.date.localeCompare(b.date));

    const now = new Date();
    const periods = [
      { label: "1M", daysAgo: 30 },
      { label: "3M", daysAgo: 90 },
      { label: "YTD", yearStart: true as const },
      { label: "1A", daysAgo: 365 },
      { label: "ALL", daysAgo: undefined as number | undefined },
    ];

    return periods.map((p) => {
      let targetDate: string;
      if (p.label === "ALL") {
        targetDate = data.history[0].date;
      } else if ("yearStart" in p && p.yearStart) {
        targetDate = `${now.getFullYear()}-01-01`;
      } else {
        const d = new Date(now);
        d.setDate(d.getDate() - (p.daysAgo ?? 0));
        targetDate = d.toISOString().split("T")[0];
      }

      // Find starting portfolio value
      const closest = data.history.find((h) => h.date >= targetDate) ?? data.history[0];
      const startValue = closest.totalValue;
      const startDate = closest.date;

      if (startValue <= 0) return { period: p.label, returnPct: 0, returnEur: 0 };

      // Filter cashflows within period
      const endDate = data.history[data.history.length - 1].date;
      const periodFlows = cashflows.filter((cf) => cf.date > startDate && cf.date <= endDate);

      // Modified Dietz: R = (V_end - V_start - sum(CF)) / (V_start + sum(CF_i * W_i))
      // W_i = (T - t_i) / T  where T = total days, t_i = days since start
      const totalDays = Math.max(1, (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
      let sumCF = 0;
      let weightedCF = 0;
      for (const cf of periodFlows) {
        const daysSinceStart = (new Date(cf.date).getTime() - new Date(startDate).getTime()) / 86400000;
        const weight = (totalDays - daysSinceStart) / totalDays;
        sumCF += cf.amount;
        weightedCF += cf.amount * weight;
      }

      const gain = totalValue - startValue - sumCF;
      const avgCapital = startValue + weightedCF;
      const returnPct = avgCapital > 0 ? (gain / avgCapital) * 100 : 0;
      const returnEur = gain;

      return { period: p.label, returnPct, returnEur };
    });
  }, [data.history, data.operations.operations, totalValue]);

  // Active rentabilidad periods based on selected method
  const rentabilidadPeriods = returnMethod === "twr" ? twrPeriods : mwrPeriods;

  // Strategy chart series (per-account history)
  const strategySeries = useMemo(() => {
    if (!data.historyByAccount || accounts.length <= 1) return [];
    return accounts.map((acc) => ({
      accountId: acc.id,
      label: acc.label || `...${acc.account_number.slice(-8)}`,
      data: data.historyByAccount?.[acc.id] ?? [],
    }));
  }, [data.historyByAccount, accounts]);

  // Combined chart data: NAV apilado + Rentabilidad % + Aportaciones netas
  // acumuladas + eventos PLUS/MINUS (Edgard MVP6 puntos 2a-d).
  //
  // - NAV apilado en cash / iic / rv. Como solo tenemos el snapshot actual
  //   de positions, calculamos el RATIO cash:iic:rv del snapshot actual y
  //   lo aplicamos a cada NAV historico (aproximacion - asume distribucion
  //   estable). Cuando tengamos historial de positions por fecha lo
  //   reemplazaremos por el desglose real.
  // - Aportaciones netas acumuladas: running total de PLUS - MINUS sobre
  //   las operaciones ordenadas por fecha de contratacion.
  // - Eventos: cada operacion PLUS o MINUS individual.
  // - Label X: incluye dia ("18 mar 26").
  const combinedChartData = useMemo(() => {
    if (data.history.length === 0) return { chartData: [], flowEvents: [], kpis: null };

    // 1) Ratio cash : iic : rv del snapshot actual
    // Usamos la fuente fiable: operation_type de la 1a compra (MVP6 #2b)
    let rvValue = 0;
    let iicValue = 0;
    for (const p of data.positions) {
      const t = resolveProductType(p.isin, p.product_name, productTypeMap);
      if (t === "rv") rvValue += p.position_value ?? 0;
      else iicValue += p.position_value ?? 0;
    }
    const cashCurrent = data.cashBalance ?? 0;
    const totalCurrent = rvValue + iicValue + cashCurrent;
    const rIic = totalCurrent > 0 ? iicValue / totalCurrent : 0;
    const rRv = totalCurrent > 0 ? rvValue / totalCurrent : 0;
    const rCash = totalCurrent > 0 ? cashCurrent / totalCurrent : 0;

    // 2) Snapshots ordenados por fecha (data.history ya viene ordenado asc)
    const snapshots = [...data.history].sort((a, b) => a.date.localeCompare(b.date));

    // 3) Eventos ordenados de PLUS/MINUS (taxonomia oficial)
    const allOps = [...data.operations.operations]
      .filter((op) => op.operation_date)
      .sort((a, b) => (a.operation_date ?? "").localeCompare(b.operation_date ?? ""));
    const flowEvents: { date: string; amount: number; netAfter: number; operationType?: string; productName?: string; isin?: string }[] = [];
    let runningNet = 0;
    for (const op of allOps) {
      const signed = flowAmountEur(op);
      if (signed === 0) continue;
      runningNet += signed;
      flowEvents.push({
        date: op.operation_date!,
        amount: signed,
        netAfter: runningNet,
        operationType: op.operation_type ?? undefined,
        productName: op.product_name ?? undefined,
        isin: op.isin ?? undefined,
      });
    }

    // Helper: aportacion neta acumulada hasta una fecha
    const netContribUntil = (date: string) => {
      let sum = 0;
      for (const e of flowEvents) {
        if (e.date <= date) sum = e.netAfter;
        else break;
      }
      return sum;
    };

    // 4) Construir puntos del grafico
    const chartData = snapshots.map((s, i) => {
      const prev = i > 0 ? snapshots[i - 1] : null;
      const nav = s.totalValue;
      const flowsBetween = prev
        ? netContribUntil(s.date) - netContribUntil(prev.date)
        : 0;

      let returnPct = 0;
      if (prev && prev.totalValue > 0) {
        if (returnMethod === "mwr") {
          // Modified Dietz simplificado: peso medio = 0.5 (aproximacion
          // razonable cuando los flujos se distribuyen uniformemente)
          const avgCap = prev.totalValue + 0.5 * flowsBetween;
          returnPct = avgCap > 0
            ? ((nav - prev.totalValue - flowsBetween) / avgCap) * 100
            : 0;
        } else {
          returnPct = ((nav - prev.totalValue - flowsBetween) / prev.totalValue) * 100;
        }
      }

      const label = new Date(s.date).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      });

      return {
        date: s.date,
        label,
        ts: new Date(s.date).getTime(),
        cash: nav * rCash,
        iic: nav * rIic,
        rv: nav * rRv,
        nav,
        returnPct,
        netContrib: netContribUntil(s.date),
      };
    });

    if (chartData.length === 0) return { chartData: [], flowEvents: [], kpis: null };

    // KPIs
    const firstNav = chartData[0].nav;
    const lastNav = chartData[chartData.length - 1].nav;
    const variacion = lastNav - firstNav;
    const variacionPct = firstNav > 0 ? (variacion / firstNav) * 100 : 0;

    let mejorMes: { month: string; pct: number } | null = null;
    let peorMes: { month: string; pct: number } | null = null;
    for (const pt of chartData) {
      if (!mejorMes || pt.returnPct > mejorMes.pct) {
        mejorMes = { month: pt.label, pct: pt.returnPct };
      }
      if (!peorMes || pt.returnPct < peorMes.pct) {
        peorMes = { month: pt.label, pct: pt.returnPct };
      }
    }

    let cumReturn = 1;
    for (const pt of chartData) cumReturn *= 1 + pt.returnPct / 100;
    const rentabilidadPeriodo = (cumReturn - 1) * 100;

    const aportacionesNetas = flowEvents.length
      ? flowEvents[flowEvents.length - 1].netAfter
      : 0;

    return {
      chartData,
      flowEvents,
      kpis: {
        valorInicio: firstNav,
        valorFin: lastNav,
        variacion,
        variacionPct,
        mejorMes,
        peorMes,
        rentabilidadPeriodo,
        aportacionesNetas,
      },
    };
  }, [data.history, data.positions, data.cashBalance, data.operations.operations, returnMethod, productTypeMap]);

  return (
    <div className={`space-y-1 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
      {/* ================================================================= */}
      {/* PORTADA / HEADER - estilo informe Rowell                          */}
      {/* ================================================================= */}
      <div className={cn("relative overflow-hidden rounded-xl px-4 py-5 shadow-lg sm:px-8 sm:py-8", isModern ? "border border-gray-200 bg-white text-gray-900 shadow-sm" : "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white")}>
        {/* Decorative elements */}
        {!isModern && (
          <>
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--color-gold-10)]" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[var(--color-gold-10)]" />
          </>
        )}

        <div className="relative">
          {/* Title row */}
          <div>
            {showBackLink && backHref && (
              <a href={backHref} className={cn("mb-3 flex items-center gap-1 text-sm", isModern ? "text-gray-400 hover:text-gray-600" : "text-white/50 hover:text-white/80")}>
                <ChevronLeft className="h-4 w-4" /> Volver
              </a>
            )}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-gold-20)] sm:h-12 sm:w-12">
                <User className="h-5 w-5 text-[var(--color-gold)] sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-gold)] sm:text-xs">
                  Informe de Cartera
                </p>
                <h1 className="truncate font-display text-xl font-bold sm:text-3xl">{clientName}</h1>
              </div>
            </div>
            {selectedAccountId !== "all" && (
              <p className={cn("mt-1 font-mono text-[10px] sm:mt-2 sm:text-xs", isModern ? "text-gray-400" : "text-white/40")}>
                {accounts.find((a) => a.id === selectedAccountId)?.account_number ?? ""}
              </p>
            )}
          </div>

          {/* Filtros — stack vertically on mobile */}
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            {accounts.length > 1 && (
              <div className="flex items-center gap-1.5">
                <Briefcase className={cn("h-4 w-4 flex-shrink-0", isModern ? "text-gray-400" : "text-white/40")} />
                <select
                  value={selectedAccountId}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-xs font-medium focus:border-[var(--color-gold)] focus:outline-none sm:w-auto sm:py-1.5",
                    isModern
                      ? "border-gray-300 bg-white text-gray-900"
                      : "border-white/20 bg-white/10 text-white backdrop-blur-sm"
                  )}
                >
                  <option value="all" className="text-gray-800">Todas las carteras</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id} className="text-gray-800">
                      ...{acc.account_number.slice(-8)}{acc.label ? ` - ${acc.label}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Date range con botones de periodo (Edgard MVP6 #3 + #4) */}
            <DateRangeBar
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChange={handleDateChange}
              minDate={availableDateRange?.minDate}
              maxDate={availableDateRange?.maxDate}
              originDate={originDate}
            />
            {/* HIDDEN UNTIL MVP6.1: toggle TWR / MWR.

                Politica: no mostrar TWR mientras no podamos garantizar
                integridad del input (snapshots completos, operation_date
                consistente, taxonomia de flujos validada). Es preferible
                esconder el selector que arriesgar a que un cliente vea un
                numero falso y lo confunda con su rentabilidad real. Esta
                salvaguarda NO es deuda tecnica — es politica de confianza
                del cliente.

                Que sigue vivo (no tocar): el state `returnMethod`, los
                useMemos `twrPeriods` y `mwrPeriods`, y la bifurcacion del
                calculo en `chartData.map(...)` (~L1253). La linea de
                rentabilidad del chart sigue mostrando TWR-subperiodo (default).
                Solo se oculta este selector de UI.

                Reactivar cuando se cumplan los criterios de aceptacion
                listados en docs/MVP6.1_TODO.md (modelo geometrico +
                validaciones de input + UI fallback "datos insuficientes"). */}
            {/*
            <div className="flex items-center gap-1.5">
              <TrendingUp className={cn("h-4 w-4 flex-shrink-0", isModern ? "text-gray-400" : "text-white/40")} />
              <div className={cn("flex overflow-hidden rounded-lg border", isModern ? "border-gray-300" : "border-white/20")}>
                <button
                  type="button"
                  onClick={() => setReturnMethod("twr")}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    returnMethod === "twr"
                      ? isModern ? "bg-[var(--color-gold)] text-white" : "bg-[var(--color-gold)] text-[var(--color-primary)]"
                      : isModern ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-white/10 text-white/70 hover:bg-white/20"
                  )}
                  title="Time Weighted Return - independiente de aportaciones"
                >
                  TWR
                </button>
                <button
                  type="button"
                  onClick={() => setReturnMethod("mwr")}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    returnMethod === "mwr"
                      ? isModern ? "bg-[var(--color-gold)] text-white" : "bg-[var(--color-gold)] text-[var(--color-primary)]"
                      : isModern ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-white/10 text-white/70 hover:bg-white/20"
                  )}
                  title="Money Weighted Return - ponderada por capital"
                >
                  MWR
                </button>
              </div>
            </div>
            */}
          </div>
        </div>
      </div>

      {/* Data integrity check */}
      <DataIntegrityAlert
        kpiTotal={totalValue}
        chartTotal={data.history.length > 0 ? data.history[data.history.length - 1].totalValue : 0}
        positionsCount={data.positions.length}
        historyPoints={data.history.length}
      />

      {/* ================================================================= */}
      {/* 1. RESUMEN DE CARTERA - Datos del inversor                        */}
      {/* ================================================================= */}
      <SectionHeader number="1" title="Resumen de Cartera" />
      <InvestorProfileCard
        totalValue={totalValue}
        totalCost={totalCost}
        pnl={pnl}
        fundCount={data.positions.length}
        cashBalance={data.cashBalance}
        netContributions={netContributions}
        latestDate={latestDate}
        positions={data.positions}
      />

      {/* Row 2: Rentabilidad + Costes + Concentración */}
      {(rentabilidadPeriods.length > 0 || totalCommissions > 0 || data.positions.length > 0) && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          {/* TODO MVP6.1: TWR calculation broken — shows +128,69% on Aurum-077 when real return is 24,29%. Fix requires geometric TWR with subperiods cut by each cash flow. See docs/MVP6.1_TODO.md */}
          {/*
          {rentabilidadPeriods.map((r) => (
            <div
              key={r.period}
              className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-4"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-gold-soft)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400 sm:text-[10px]">
                {returnMethod === "twr" ? "TWR" : "MWR"} {r.period}
              </p>
              <p className={`mt-0.5 text-base font-bold sm:mt-1 sm:text-lg ${r.returnPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                <AnimatedValue value={r.returnPct} format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`} />
              </p>
              <p className="text-[9px] text-gray-400 sm:text-[10px]">
                <AnimatedValue value={r.returnEur} format={(v) => `${v >= 0 ? "+" : ""}${formatEur(v)}`} />
              </p>
            </div>
          ))}
          */}
          {/* Plusvalía total económica */}
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-4">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-gold-soft)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400 sm:text-[10px]">Plusvalia total economica</p>
            <p className={`mt-0.5 text-base font-bold sm:mt-1 sm:text-lg ${plusvaliaTotalEco >= 0 ? "text-green-600" : "text-red-600"}`}>
              <AnimatedValue value={plusvaliaTotalEco} format={(v) => `${v >= 0 ? "+" : ""}${formatEur(v)}`} />
            </p>
            <p className="text-[9px] text-gray-400 sm:text-[10px]">Patrimonio - aportaciones netas</p>
          </div>
          {/* Concentración */}
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-4">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-gold-soft)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400 sm:text-[10px]">Concentracion</p>
            <p className="mt-0.5 text-base font-bold text-[var(--color-primary)] sm:mt-1 sm:text-lg">Top 5: <AnimatedValue value={concTop5} format={(v) => `${v.toFixed(1)}%`} /></p>
            <p className="text-[9px] text-gray-400 sm:text-[10px]">Top 10: {concTop10.toFixed(1)}%</p>
          </div>
          {/* Comisiones + Retenciones */}
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-4">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-gold-soft)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400 sm:text-[10px]">Costes acumulados</p>
            <p className="mt-0.5 text-base font-bold text-[var(--color-primary)] sm:mt-1 sm:text-lg"><AnimatedValue value={totalCommissions + totalRetentions} format={formatEur} /></p>
            <p className="text-[9px] text-gray-400 sm:text-[10px]">
              Com: {formatEur(totalCommissions)} · Ret: {formatEur(totalRetentions)}
            </p>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. EVOLUCION PATRIMONIAL — Gráfico combinado                      */}
      {/* ================================================================= */}
      <SectionDivider />
      <SectionHeader number="2" title="Evolucion Patrimonial" collapsible open={sectionsOpen["2"]} onToggle={() => toggleSection("2")} />
      {sectionsOpen["2"] && (
        <>
          {combinedChartData.kpis ? (
            <CombinedChart
              data={combinedChartData.chartData}
              flowEvents={combinedChartData.flowEvents}
              kpis={combinedChartData.kpis}
            />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
              <p className="text-sm text-gray-400">Sin datos suficientes para generar el grafico</p>
            </div>
          )}

          {accounts.length > 1 && data.historyByAccount && strategySeries.length > 0 && (
            <div className="mt-6">
              <StrategyChart series={strategySeries} />
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* 3. DISTRIBUCION DE ACTIVOS                                        */}
      {/* ================================================================= */}
      <SectionDivider />
      <SectionHeader number="3" title="Distribucion de Activos" collapsible open={sectionsOpen["3"]} onToggle={() => toggleSection("3")} />
      {sectionsOpen["3"] && (
        <AssetDistribution positions={data.positions} cashBalance={data.cashBalance} productTypeMap={productTypeMap} />
      )}

      {/* ================================================================= */}
      {/* 4. POSICIONES (con tabs: resumen IIC/RV + detalle producto)       */}
      {/* ================================================================= */}
      <SectionDivider />
      <SectionHeader number="4" title={`Posiciones (${data.positions.length})`} collapsible open={sectionsOpen["4"]} onToggle={() => toggleSection("4")} />
      {sectionsOpen["4"] && (
        <>
          <div className="mb-4 flex items-center gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setActiveTab("cartera")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === "cartera"
                  ? "bg-white text-[var(--color-primary)] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <PieChartIcon className="h-4 w-4" />
              Resumen IIC / RV
            </button>
            <button
              onClick={() => setActiveTab("operaciones")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === "operaciones"
                  ? "bg-white text-[var(--color-primary)] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <FileText className="h-4 w-4" />
              Detalle producto
            </button>
          </div>
          {activeTab === "cartera" ? (
            <PositionsTable
              positions={data.positions}
              eurCostMap={eurCostMap}
              productTypeMap={productTypeMap}
            />
          ) : (
            <PortfolioTable positions={data.positions} />
          )}
        </>
      )}

      <SectionDivider />

      {/* ================================================================= */}
      {/* 5. OPERACIONES                                                    */}
      {/* ================================================================= */}
      <SectionHeader number="5" title={`Operaciones (${data.operations.total})`} collapsible open={sectionsOpen["5"]} onToggle={() => toggleSection("5")} />

      {sectionsOpen["5"] && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {data.operations.operations.length === 0 ? (
            <p className="py-12 text-center text-gray-400">
              No hay operaciones para el periodo seleccionado.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-[var(--color-table-header-bg)] text-xs uppercase text-[var(--color-table-header-text)]">
                      <th className="w-8 px-3 py-2.5"></th>
                      <th className="px-3 py-2.5 font-medium">Fecha</th>
                      <th className="px-3 py-2.5 font-medium">Tipo</th>
                      <th className="px-3 py-2.5 font-medium">Producto</th>
                      <th className="px-3 py-2.5 text-right font-medium">Titulos</th>
                      <th className="px-3 py-2.5 text-right font-medium">Importe EUR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.operations.operations.map((op: Operation, idx) => (
                      <tr
                        key={op.id}
                        className={`border-b border-gray-100 last:border-0 ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        } hover:bg-[var(--color-bg)]`}
                      >
                        <td className="px-3 py-2">{getOpIcon(op.operation_type)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{formatDate(op.operation_date)}</td>
                        <td className={`px-3 py-2 text-xs font-medium ${getOpColor(op.operation_type)}`}>
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
                          {op.eur_amount != null ? formatEur2(op.eur_amount) : "\u2014"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.operations.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-gray-400">{data.operations.total} operaciones</p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePageChange(opsPage - 1)}
                      disabled={opsPage <= 1}
                      className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    ><ChevronLeft className="h-4 w-4" /></button>
                    <span className="px-2 text-xs text-gray-500">{opsPage} / {data.operations.totalPages}</span>
                    <button
                      onClick={() => handlePageChange(opsPage + 1)}
                      disabled={opsPage >= data.operations.totalPages}
                      className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    ><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 6. ESPACIO PERSONAL – Comunicacion y Documentos                    */}
      {/* ================================================================= */}
      {clientId && (
        <>
          <SectionDivider />
          <SectionHeader number="6" title="Tu Espacio Personal" collapsible open={sectionsOpen["6"]} onToggle={() => toggleSection("6")} />
          {sectionsOpen["6"] && (
            <CommunicationPanel
              clientId={clientId}
              clientName={clientName}
              isAdmin={isAdmin}
            />
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* Footer branding                                                    */}
      {/* ================================================================= */}
      <div className="mt-8 flex items-center justify-center gap-2 pb-4 text-xs text-gray-400">
        <div className="h-px w-12 bg-[var(--color-gold-30)]" />
        <span className="font-display font-semibold text-[var(--color-gold)]/60">Rowell Patrimonios</span>
        <div className="h-px w-12 bg-[var(--color-gold-30)]" />
      </div>
    </div>
  );
}
