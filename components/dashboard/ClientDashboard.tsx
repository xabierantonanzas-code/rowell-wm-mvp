"use client";

import { useState, useMemo } from "react";
import type { Position, Operation } from "@/lib/types/database";
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Briefcase,
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
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
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
  positions,
}: {
  totalValue: number;
  totalCost: number;
  pnl: number;
  fundCount: number;
  cashBalance: number;
  latestDate: string;
  positions: Position[];
}) {
  const investedValue = totalValue - cashBalance;
  const cashPct = totalValue > 0 ? (cashBalance / totalValue) * 100 : 0;
  const isinCount = new Set(positions.map((p) => p.isin).filter(Boolean)).size;

  const kpis = [
    {
      label: "Patrimonio total",
      value: formatEur(totalValue),
      sub: `Coste: ${formatEur(totalCost)}`,
      accent: false,
    },
    {
      label: "Patrimonio invertido",
      value: formatEur(investedValue),
      sub: `${fundCount} posiciones`,
      accent: false,
    },
    {
      label: "Efectivo disponible",
      value: formatEur(cashBalance),
      sub: "Liquidez",
      accent: false,
    },
    {
      label: "% Efectivo",
      value: `${cashPct.toFixed(1)}%`,
      sub: "Sobre patrimonio total",
      accent: false,
    },
    {
      label: "Plusvalia latente",
      value: `${pnl >= 0 ? "+" : ""}${formatEur(totalValue - totalCost)}`,
      sub: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}% sobre coste`,
      accent: true,
      positive: pnl >= 0,
    },
    {
      label: "Plusvalia latente %",
      value: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%`,
      sub: `Coste: ${formatEur(totalCost)}`,
      accent: true,
      positive: pnl >= 0,
    },
    {
      label: "N° fondos",
      value: String(fundCount),
      sub: latestDate,
      accent: false,
    },
    {
      label: "N° ISINs",
      value: String(isinCount),
      sub: `${isinCount} instrumentos unicos`,
      accent: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map((kpi, i) => (
        <div
          key={kpi.label}
          className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#C9A84C] to-[#E8C870] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
            {kpi.label}
          </p>
          <p
            className={`font-display text-2xl font-bold ${
              kpi.accent
                ? kpi.positive
                  ? "text-green-600"
                  : "text-red-600"
                : "text-[#0B1D3A]"
            }`}
          >
            {kpi.value}
          </p>
          <p className="mt-1 text-xs text-gray-400">{kpi.sub}</p>
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
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#0B1D3A]">
          <Target className="h-4 w-4 text-[#C9A84C]" />
          Top 10 Posiciones
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-[#0B1D3A] text-xs uppercase text-white">
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
                  className={`border-b border-gray-100 last:border-0 transition-colors hover:bg-[#F5F3EE] ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                  }`}
                >
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-xs font-semibold text-[#0B1D3A]">
                    {pos.product_name}
                  </td>
                  <td className="max-w-[120px] truncate px-4 py-2.5 text-xs text-gray-500">
                    {pos.manager ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-[#0B1D3A]">
                    {formatEur(pos.position_value ?? 0)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs tabular-nums text-gray-500">
                        {weight.toFixed(1)}%
                      </span>
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-[#C9A84C] transition-all duration-500"
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
  clientId,
  accounts,
  availableDateRange,
  initialData,
  fetchUrl,
  showBackLink,
  backHref,
  isAdmin = false,
}: ClientDashboardProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | "all">(
    accounts.length === 1 ? accounts[0].id : "all"
  );
  const [dateFrom, setDateFrom] = useState<string | undefined>(initialData.dateFrom ?? undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(initialData.dateTo ?? undefined);
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"cartera" | "operaciones">("cartera");
  const [opsPage, setOpsPage] = useState(1);
  const [returnMethod, setReturnMethod] = useState<"twr" | "mwr">("twr");

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

  // Aportaciones netas y comisiones (computed from operations)
  const { netContributions, totalContributions, totalWithdrawals, totalCommissions, totalRetentions } = useMemo(() => {
    let contributions = 0, withdrawals = 0, commissions = 0, retentions = 0;
    for (const op of data.operations.operations) {
      const amount = Math.abs(op.eur_amount ?? 0);
      const t = (op.operation_type ?? "").toLowerCase();
      if (t.includes("compra") || t.includes("suscripci")) contributions += amount;
      else if (t.includes("venta") || t.includes("reembolso")) withdrawals += amount;
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
  // Traspasos internos (TRASPASO INT.) no cuentan como flujo de capital nuevo
  const mwrPeriods = useMemo(() => {
    if (data.history.length === 0 || totalValue === 0) return [];

    const TRASPASO_INT_KEYWORDS = ["traspaso int", "traspaso. int"];
    const isTraspInterno = (t: string) =>
      TRASPASO_INT_KEYWORDS.some((kw) => t.toLowerCase().includes(kw));

    // Build sorted cashflows from operations (only real external flows)
    const cashflows: { date: string; amount: number }[] = [];
    for (const op of data.operations.operations) {
      if (!op.operation_date || !op.operation_type) continue;
      if (isTraspInterno(op.operation_type)) continue;
      const t = op.operation_type.toLowerCase();
      const amount = Math.abs(op.eur_amount ?? 0);
      if (t.includes("compra") || t.includes("suscripci")) {
        cashflows.push({ date: op.operation_date, amount }); // inflow = positive
      } else if (t.includes("venta") || t.includes("reembolso")) {
        cashflows.push({ date: op.operation_date, amount: -amount }); // outflow = negative
      }
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

  // Combined chart data: NAV + Rentabilidad % + Flujos por mes
  const combinedChartData = useMemo(() => {
    if (data.history.length === 0) return { chartData: [], kpis: null };

    // Group history by month (use last snapshot of each month as NAV)
    const navByMonth = new Map<string, { nav: number; date: string }>();
    for (const h of data.history) {
      const d = new Date(h.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      // Keep the last snapshot of the month
      navByMonth.set(key, { nav: h.totalValue, date: h.date });
    }

    // Group flows by month from operations
    const flowsByMonthMap = new Map<string, number>();
    for (const op of data.operations.operations) {
      if (!op.operation_date) continue;
      const d = new Date(op.operation_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const t = (op.operation_type ?? "").toLowerCase();
      const amount = Math.abs(op.eur_amount ?? 0);
      if (t.includes("compra") || t.includes("suscripci")) {
        flowsByMonthMap.set(key, (flowsByMonthMap.get(key) ?? 0) + amount);
      } else if (t.includes("venta") || t.includes("reembolso")) {
        flowsByMonthMap.set(key, (flowsByMonthMap.get(key) ?? 0) - amount);
      }
    }

    // Build chart data sorted by month
    const months = Array.from(navByMonth.keys()).sort();

    const chartData = months.map((m, i) => {
      const nav = navByMonth.get(m)!.nav;
      const prevNav = i > 0 ? (navByMonth.get(months[i - 1])?.nav ?? nav) : nav;
      const flows = flowsByMonthMap.get(m) ?? 0;
      // Monthly return: (NAV_end - NAV_start - flows) / NAV_start
      const returnPct = prevNav > 0 ? ((nav - prevNav - flows) / prevNav) * 100 : 0;

      const label = new Date(m + "-15").toLocaleDateString("es-ES", {
        month: "short",
        year: "2-digit",
      });

      return { month: label, rawMonth: m, nav, returnPct, flows };
    });

    if (chartData.length === 0) return { chartData: [], kpis: null };

    // KPIs
    const firstNav = chartData[0].nav;
    const lastNav = chartData[chartData.length - 1].nav;
    const variacion = lastNav - firstNav;
    const variacionPct = firstNav > 0 ? (variacion / firstNav) * 100 : 0;

    // Best/worst month
    let mejorMes: { month: string; pct: number } | null = null;
    let peorMes: { month: string; pct: number } | null = null;
    for (const pt of chartData) {
      if (!mejorMes || pt.returnPct > mejorMes.pct) {
        mejorMes = { month: pt.month, pct: pt.returnPct };
      }
      if (!peorMes || pt.returnPct < peorMes.pct) {
        peorMes = { month: pt.month, pct: pt.returnPct };
      }
    }

    // Period return (chained)
    let cumReturn = 1;
    for (const pt of chartData) {
      cumReturn *= 1 + pt.returnPct / 100;
    }
    const rentabilidadPeriodo = (cumReturn - 1) * 100;

    const aportacionesNetas = chartData.reduce((s, pt) => s + pt.flows, 0);

    return {
      chartData,
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
  }, [data.history, data.operations.operations]);

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
              <input
                type="date"
                value={dateFrom ?? ""}
                min={availableDateRange?.minDate}
                max={dateTo || availableDateRange?.maxDate}
                onChange={(e) => handleDateChange(e.target.value || undefined, dateTo)}
                className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-xs font-medium text-white backdrop-blur-sm focus:border-[#c9a94e] focus:outline-none [color-scheme:dark]"
              />
              <span className="text-xs text-white/40">—</span>
              <input
                type="date"
                value={dateTo ?? ""}
                min={dateFrom || availableDateRange?.minDate}
                max={availableDateRange?.maxDate}
                onChange={(e) => handleDateChange(dateFrom, e.target.value || undefined)}
                className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-xs font-medium text-white backdrop-blur-sm focus:border-[#c9a94e] focus:outline-none [color-scheme:dark]"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => handleDateChange(undefined, undefined)}
                  className="rounded-lg bg-white/10 px-2 py-1.5 text-xs font-medium text-white/70 hover:bg-white/20 transition-colors"
                >
                  Todo
                </button>
              )}
            </div>
            {/* Toggle TWR / MWR */}
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-white/40" />
              <div className="flex gap-0">
                <button
                  onClick={() => setReturnMethod("twr")}
                  className={`rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    returnMethod === "twr"
                      ? "bg-[#c9a94e] text-[#1e3a5f] shadow"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                  title="Time Weighted Return — rentabilidad independiente de aportaciones"
                >
                  TWR
                </button>
                <button
                  onClick={() => setReturnMethod("mwr")}
                  className={`rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    returnMethod === "mwr"
                      ? "bg-[#c9a94e] text-[#1e3a5f] shadow"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                  title="Money Weighted Return — rentabilidad ponderada por capital invertido"
                >
                  MWR
                </button>
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
        positions={data.positions}
      />

      {/* Row 3: Rentabilidad + Costes + Concentración */}
      {(rentabilidadPeriods.length > 0 || totalCommissions > 0 || data.positions.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Rentabilidad por periodos */}
          {rentabilidadPeriods.map((r) => (
            <div
              key={r.period}
              className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#C9A84C] to-[#E8C870] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                {returnMethod === "twr" ? "TWR" : "MWR"} {r.period}
              </p>
              <p className={`mt-1 text-lg font-bold ${r.returnPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                {r.returnPct >= 0 ? "+" : ""}{r.returnPct.toFixed(2)}%
              </p>
              <p className="text-[10px] text-gray-400">
                {r.returnEur >= 0 ? "+" : ""}{formatEur(r.returnEur)}
              </p>
            </div>
          ))}
          {/* Plusvalía total económica */}
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#C9A84C] to-[#E8C870] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Plusvalia total economica</p>
            <p className={`mt-1 text-lg font-bold ${plusvaliaTotalEco >= 0 ? "text-green-600" : "text-red-600"}`}>
              {plusvaliaTotalEco >= 0 ? "+" : ""}{formatEur(plusvaliaTotalEco)}
            </p>
            <p className="text-[10px] text-gray-400">Patrimonio - aportaciones netas</p>
          </div>
          {/* Concentración */}
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#C9A84C] to-[#E8C870] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Concentracion</p>
            <p className="mt-1 text-lg font-bold text-[#0B1D3A]">Top 5: {concTop5.toFixed(1)}%</p>
            <p className="text-[10px] text-gray-400">Top 10: {concTop10.toFixed(1)}%</p>
          </div>
          {/* Comisiones + Retenciones */}
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#C9A84C] to-[#E8C870] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Costes acumulados</p>
            <p className="mt-1 text-lg font-bold text-[#0B1D3A]">{formatEur(totalCommissions + totalRetentions)}</p>
            <p className="text-[10px] text-gray-400">
              Com: {formatEur(totalCommissions)} · Ret: {formatEur(totalRetentions)}
            </p>
          </div>
        </div>
      )}

      {/* Top Holdings */}
      <div className="mt-4">
        <TopHoldings positions={data.positions} />
      </div>

      <SectionDivider />

      {/* ================================================================= */}
      {/* 2. DISTRIBUCION DE ACTIVOS                                        */}
      {/* ================================================================= */}
      <SectionHeader number="2" title="Distribucion de Activos" />
      <AssetDistribution positions={data.positions} />

      <SectionDivider />

      {/* ================================================================= */}
      {/* 3. EVOLUCION PATRIMONIAL — Gráfico combinado                      */}
      {/* ================================================================= */}
      <SectionHeader number="3" title="Evolucion Patrimonial" />
      {combinedChartData.kpis ? (
        <CombinedChart
          data={combinedChartData.chartData}
          kpis={combinedChartData.kpis}
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">Sin datos suficientes para generar el grafico</p>
        </div>
      )}

      {/* Gráfico acumulativo por estrategias (solo multi-cuenta) */}
      {accounts.length > 1 && data.historyByAccount && strategySeries.length > 0 && (
        <div className="mt-6">
          <StrategyChart series={strategySeries} />
        </div>
      )}

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
      {/* 5. ESPACIO PERSONAL – Comunicacion y Documentos                    */}
      {/* ================================================================= */}
      {clientId && (
        <>
          <SectionDivider />
          <SectionHeader number="5" title="Tu Espacio Personal" />
          <CommunicationPanel
            clientId={clientId}
            clientName={clientName}
            isAdmin={isAdmin}
          />
        </>
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
