"use client";

import { useState, useMemo } from "react";
import type { Position, Operation } from "@/lib/types/database";
import {
  Wallet,
  TrendingUp,
  BarChart3,
  Clock,
  Calendar,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Shield,
  PieChart as PieChartIcon,
  Target,
  User,
} from "lucide-react";
import PositionsTable from "@/components/dashboard/PositionsTable";
import EvolutionChart from "@/components/dashboard/EvolutionChart";
import DistributionChart from "@/components/dashboard/DistributionChart";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

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

interface DashboardData {
  accountId: string;
  year: number | null;
  positions: Position[];
  history: HistoryPoint[];
  operations: OperationsData;
  cashBalance: number;
}

interface ClientDashboardProps {
  clientName: string;
  accounts: AccountOption[];
  availableYears: number[];
  initialData: DashboardData;
  fetchUrl: string;
  showBackLink?: boolean;
  backHref?: string;
}

// ===========================================================================
// Constants
// ===========================================================================

const NAVY = "#1e3a5f";
const GOLD = "#c9a94e";
const LIGHT_BG = "#f5f3ee";

const PIE_COLORS = [
  "#1e3a5f", "#c9a94e", "#2563eb", "#059669", "#d97706",
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

function getOpIcon(type: string | null) {
  const t = (type ?? "").toLowerCase();
  if (t.includes("compra") || t.includes("suscripci"))
    return <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" />;
  if (t.includes("venta") || t.includes("reembolso"))
    return <ArrowUpRight className="h-3.5 w-3.5 text-red-600" />;
  return <RefreshCw className="h-3.5 w-3.5 text-blue-500" />;
}

function getOpColor(type: string | null): string {
  const t = (type ?? "").toLowerCase();
  if (t.includes("compra") || t.includes("suscripci")) return "text-green-600";
  if (t.includes("venta") || t.includes("reembolso")) return "text-red-600";
  return "text-blue-600";
}

// ===========================================================================
// Sub-components: Section header (replica del estilo del informe)
// ===========================================================================

function SectionHeader({
  number,
  title,
}: {
  number: string;
  title: string;
}) {
  return (
    <div className="relative mb-6 mt-2">
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#1e3a5f] to-[#2a5080] opacity-90" />
      <h2 className="relative px-6 py-3 font-display text-lg font-bold text-white">
        {number}. {title}
      </h2>
    </div>
  );
}

function SectionDivider() {
  return <div className="my-8 h-px bg-gradient-to-r from-transparent via-[#c9a94e]/40 to-transparent" />;
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
  latestDate,
}: {
  totalValue: number;
  totalCost: number;
  pnl: number;
  fundCount: number;
  cashBalance: number;
  latestDate: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Datos del inversor */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#1e3a5f]">
          <User className="h-4 w-4 text-[#c9a94e]" />
          Resumen de Cartera
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-sm text-gray-500">Patrimonio Total</span>
            <span className="text-lg font-bold text-[#1e3a5f]">{formatEur(totalValue)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-sm text-gray-500">Coste de Adquisicion</span>
            <span className="text-sm font-medium text-gray-700">{formatEur(totalCost)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-sm text-gray-500">Plusvalia / Minusvalia</span>
            <span className={`text-sm font-bold ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
              {pnl >= 0 ? "+" : ""}{formatEur(totalValue - totalCost)} ({pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%)
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-sm text-gray-500">Efectivo disponible</span>
            <span className="text-sm font-medium text-gray-700">{formatEur(cashBalance)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-sm text-gray-500">Numero de fondos</span>
            <span className="text-sm font-medium text-gray-700">{fundCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Ultimo corte</span>
            <span className="text-sm font-medium text-gray-700">{latestDate}</span>
          </div>
        </div>
      </div>

      {/* KPI visual cards - estilo informe */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <Wallet className="mb-2 h-8 w-8 text-[#c9a94e]" />
          <p className="text-center text-xs font-medium uppercase tracking-wider text-gray-400">Patrimonio</p>
          <p className="mt-1 text-xl font-bold text-[#1e3a5f]">{formatEur(totalValue)}</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <TrendingUp className={`mb-2 h-8 w-8 ${pnl >= 0 ? "text-green-500" : "text-red-500"}`} />
          <p className="text-center text-xs font-medium uppercase tracking-wider text-gray-400">Rendimiento</p>
          <p className={`mt-1 text-xl font-bold ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
            {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <BarChart3 className="mb-2 h-8 w-8 text-[#c9a94e]" />
          <p className="text-center text-xs font-medium uppercase tracking-wider text-gray-400">Fondos</p>
          <p className="mt-1 text-xl font-bold text-[#1e3a5f]">{fundCount}</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <Clock className="mb-2 h-8 w-8 text-[#c9a94e]" />
          <p className="text-center text-xs font-medium uppercase tracking-wider text-gray-400">Corte</p>
          <p className="mt-1 text-center text-sm font-bold text-[#1e3a5f]">{latestDate}</p>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-component: Asset Distribution (like page 5 of informe)
// ===========================================================================

function AssetDistribution({ positions }: { positions: Position[] }) {
  if (positions.length === 0) return null;

  // Agrupar por gestora
  const byManager = new Map<string, number>();
  for (const pos of positions) {
    const manager = pos.manager || "Otros";
    byManager.set(manager, (byManager.get(manager) ?? 0) + (pos.position_value ?? 0));
  }
  const managerData = Array.from(byManager.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name: name.length > 20 ? name.slice(0, 17) + "..." : name,
      value,
    }));

  // Agrupar por moneda
  const byCurrency = new Map<string, number>();
  for (const pos of positions) {
    const currency = pos.currency || "EUR";
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + (pos.position_value ?? 0));
  }
  const currencyData = Array.from(byCurrency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  const totalValue = positions.reduce((s, p) => s + (p.position_value ?? 0), 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Por Gestora - estilo informe con tabla + donut */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#1e3a5f]">
          <PieChartIcon className="h-4 w-4 text-[#c9a94e]" />
          Distribucion por Gestora
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-1/2">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={managerData.slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {managerData.slice(0, 8).map((_, i) => (
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
            {managerData.slice(0, 8).map((item, i) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <div
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="flex-1 truncate text-gray-600">{item.name}</span>
                <span className="font-medium text-gray-800">
                  {((item.value / totalValue) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Por Moneda */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#1e3a5f]">
          <Target className="h-4 w-4 text-[#c9a94e]" />
          Distribucion por Moneda
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-1/2">
            <ResponsiveContainer width="100%" height={200}>
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
                  ({((item.value / totalValue) * 100).toFixed(1)}%)
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
            <tr className="bg-[#1e3a5f] text-xs uppercase text-white">
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
                  } hover:bg-[#f5f3ee]`}
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
                  <td className="px-3 py-2 text-right text-xs font-semibold text-[#1e3a5f]">
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
            <tr className="border-t-2 border-[#c9a94e] bg-[#f5f3ee]">
              <td colSpan={6} className="px-3 py-2.5 text-right text-xs font-bold uppercase text-[#1e3a5f]">
                Total
              </td>
              <td className={`px-3 py-2.5 text-right text-xs font-bold ${
                totalValue - totalCost >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {totalCost > 0
                  ? `${totalValue - totalCost >= 0 ? "+" : ""}${(((totalValue - totalCost) / totalCost) * 100).toFixed(2)}%`
                  : "\u2014"}
              </td>
              <td className="px-3 py-2.5 text-right text-xs font-bold text-[#1e3a5f]">
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
  accounts,
  availableYears,
  initialData,
  fetchUrl,
  showBackLink,
  backHref,
}: ClientDashboardProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | "all">(
    accounts.length === 1 ? accounts[0].id : "all"
  );
  const [selectedYear, setSelectedYear] = useState<number | null>(initialData.year);
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"cartera" | "operaciones">("cartera");
  const [opsPage, setOpsPage] = useState(1);

  // Fetch data
  const fetchData = async (accountId: string | "all", year: number | null, page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (accountId !== "all") params.set("account", accountId);
      if (year) params.set("year", String(year));
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

  const handleYearChange = (year: number | null) => {
    setSelectedYear(year);
    fetchData(selectedAccountId, year);
  };

  const handleAccountChange = (accountId: string | "all") => {
    setSelectedAccountId(accountId);
    fetchData(accountId, selectedYear);
  };

  const handlePageChange = (page: number) => {
    fetchData(selectedAccountId, selectedYear, page);
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

  // Chart data: operations by month for bar chart
  const opsByMonth = useMemo(() => {
    const map = new Map<string, { compras: number; ventas: number }>();
    for (const op of data.operations.operations) {
      if (!op.operation_date) continue;
      const d = new Date(op.operation_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { compras: 0, ventas: 0 });
      const entry = map.get(key)!;
      const t = (op.operation_type ?? "").toLowerCase();
      const amount = Math.abs(op.eur_amount ?? 0);
      if (t.includes("compra") || t.includes("suscripci")) {
        entry.compras += amount;
      } else if (t.includes("venta") || t.includes("reembolso")) {
        entry.ventas += amount;
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month: new Date(month + "-01").toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
        Compras: data.compras,
        Ventas: data.ventas,
      }));
  }, [data.operations.operations]);

  return (
    <div className={`space-y-1 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
      {/* ================================================================= */}
      {/* PORTADA / HEADER - estilo informe Rowell                          */}
      {/* ================================================================= */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#0f1f33] px-8 py-8 text-white shadow-lg">
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#c9a94e]/10" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[#c9a94e]/5" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {showBackLink && backHref && (
              <a href={backHref} className="mb-3 flex items-center gap-1 text-sm text-white/50 hover:text-white/80">
                <ChevronLeft className="h-4 w-4" /> Volver
              </a>
            )}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#c9a94e]/20">
                <User className="h-6 w-6 text-[#c9a94e]" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-[#c9a94e]">
                  Informe de Cartera
                </p>
                <h1 className="font-display text-2xl font-bold sm:text-3xl">{clientName}</h1>
              </div>
            </div>
            {selectedAccountId !== "all" && (
              <p className="mt-2 font-mono text-xs text-white/40">
                {accounts.find((a) => a.id === selectedAccountId)?.account_number ?? ""}
              </p>
            )}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            {accounts.length > 1 && (
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-white/40" />
                <select
                  value={selectedAccountId}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm focus:border-[#c9a94e] focus:outline-none"
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
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-white/40" />
              <div className="flex gap-0.5">
                <button
                  onClick={() => handleYearChange(null)}
                  className={`rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedYear === null
                      ? "bg-[#c9a94e] text-[#1e3a5f] shadow"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >Todo</button>
                {availableYears.map((year, i) => (
                  <button
                    key={year}
                    onClick={() => handleYearChange(year)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      i === availableYears.length - 1 ? "rounded-r-lg" : ""
                    } ${
                      selectedYear === year
                        ? "bg-[#c9a94e] text-[#1e3a5f] shadow"
                        : "bg-white/10 text-white/70 hover:bg-white/20"
                    }`}
                  >{year}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

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
        latestDate={latestDate}
      />

      <SectionDivider />

      {/* ================================================================= */}
      {/* 2. DISTRIBUCION DE ACTIVOS                                        */}
      {/* ================================================================= */}
      <SectionHeader number="2" title="Distribucion de Activos" />
      <AssetDistribution positions={data.positions} />

      <SectionDivider />

      {/* ================================================================= */}
      {/* 3. EVOLUCION PATRIMONIAL + OPERACIONES                            */}
      {/* ================================================================= */}
      <SectionHeader number="3" title="Evolucion Patrimonial" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Evolucion */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#1e3a5f]">
            <TrendingUp className="h-4 w-4 text-[#c9a94e]" />
            Patrimonio a lo largo del tiempo
          </h3>
          {data.history.length > 0 ? (
            <EvolutionChart data={data.history} />
          ) : (
            <p className="py-12 text-center text-sm text-gray-400">Sin datos suficientes</p>
          )}
        </div>

        {/* Flujo de operaciones (bar chart) */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#1e3a5f]">
            <BarChart3 className="h-4 w-4 text-[#c9a94e]" />
            Flujo de Operaciones
          </h3>
          {opsByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={opsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  width={60}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [formatEur(value), name]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="Compras" fill="#059669" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Ventas" fill="#dc2626" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-gray-400">Sin operaciones en el periodo</p>
          )}
        </div>
      </div>

      <SectionDivider />

      {/* ================================================================= */}
      {/* 4. CARTERA DE INVERSION ROWELL / OPERACIONES                      */}
      {/* ================================================================= */}
      <SectionHeader number="4" title="Cartera de Inversion Rowell" />

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab("cartera")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "cartera"
              ? "bg-white text-[#1e3a5f] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <PieChartIcon className="h-4 w-4" />
          Posiciones ({data.positions.length})
        </button>
        <button
          onClick={() => setActiveTab("operaciones")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "operaciones"
              ? "bg-white text-[#1e3a5f] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <FileText className="h-4 w-4" />
          Operaciones ({data.operations.total})
        </button>
      </div>

      {activeTab === "cartera" ? (
        <PortfolioTable positions={data.positions} />
      ) : (
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
                    <tr className="bg-[#1e3a5f] text-xs uppercase text-white">
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
                        } hover:bg-[#f5f3ee]`}
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
      {/* Footer branding                                                    */}
      {/* ================================================================= */}
      <div className="mt-8 flex items-center justify-center gap-2 pb-4 text-xs text-gray-400">
        <div className="h-px w-12 bg-[#c9a94e]/30" />
        <span className="font-display font-semibold text-[#c9a94e]/60">Rowell Patrimonios</span>
        <div className="h-px w-12 bg-[#c9a94e]/30" />
      </div>
    </div>
  );
}
