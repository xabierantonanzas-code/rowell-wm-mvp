"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Position, Operation } from "@/lib/types/database";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Wallet,
  TrendingUp,
  BarChart3,
  Clock,
  Users,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import PositionsTable from "@/components/dashboard/PositionsTable";
import EvolutionChart from "@/components/dashboard/EvolutionChart";
import DistributionChart from "@/components/dashboard/DistributionChart";

// ===========================================================================
// Types
// ===========================================================================

interface ClientInfo {
  id: string;
  name: string;
  email: string | null;
  accounts: { id: string; account_number: string; label: string | null }[];
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

interface AumData {
  totalAUM: number;
  snapshotDate: string | null;
  totalAccounts: number;
  totalPositions: number;
}

interface AdminDashboardProps {
  clients: ClientInfo[];
  unassignedAccounts: { id: string; account_number: string; label: string | null }[];
  selectedClientId: string | null;
  aumData: AumData;
  availableYears: number[];
  initialYear: number | null;
  initialPositions: Position[];
  initialHistory: HistoryPoint[];
  initialOperations: OperationsData;
  activeClientName: string;
  totalAccounts: number;
}

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
// Component
// ===========================================================================

export default function AdminDashboard({
  clients,
  unassignedAccounts,
  selectedClientId,
  aumData,
  availableYears,
  initialYear,
  initialPositions,
  initialHistory,
  initialOperations,
  activeClientName,
  totalAccounts,
}: AdminDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [selectedClient, setSelectedClient] = useState<string | null>(
    selectedClientId
  );
  const [selectedYear, setSelectedYear] = useState<number | null>(initialYear);
  const [positions, setPositions] = useState<Position[]>(initialPositions);
  const [history, setHistory] = useState<HistoryPoint[]>(initialHistory);
  const [operations, setOperations] = useState<OperationsData>(initialOperations);
  const [clientName, setClientName] = useState(activeClientName);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"posiciones" | "operaciones">(
    "posiciones"
  );
  const [opsPage, setOpsPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Filtered clients for search
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        c.accounts.some((a) => a.account_number.includes(q))
    );
  }, [clients, searchQuery]);

  // Fetch data
  const fetchData = async (
    clientId: string | null,
    year: number | null,
    page: number = 1
  ) => {
    setLoading(true);
    try {
      // Determinar account IDs
      let accountIds: string[] = [];
      if (clientId) {
        const cl = clients.find((c) => c.id === clientId);
        if (cl) accountIds = cl.accounts.map((a) => a.id);
      } else {
        // Todos los clientes
        accountIds = clients.flatMap((c) => c.accounts.map((a) => a.id));
        // Incluir no asignados
        accountIds.push(...unassignedAccounts.map((a) => a.id));
      }

      if (accountIds.length === 0) {
        setPositions([]);
        setHistory([]);
        setOperations({ operations: [], total: 0, page: 1, totalPages: 0 });
        return;
      }

      const params = new URLSearchParams();
      params.set("accounts", JSON.stringify(accountIds));
      if (year) params.set("year", String(year));
      params.set("page", String(page));

      // Si single account, usar account param en vez de accounts
      if (accountIds.length === 1) {
        params.delete("accounts");
        params.set("account", accountIds[0]);
      }

      const res = await fetch(`/api/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      setPositions(data.positions);
      setHistory(data.history);
      setOperations(data.operations);
      setOpsPage(page);
    } catch (err) {
      console.error("Error fetching admin dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleClientChange = (clientId: string | null) => {
    setSelectedClient(clientId);
    const cl = clientId ? clients.find((c) => c.id === clientId) : null;
    setClientName(cl ? cl.name : "Todos los Clientes");
    setActiveTab("posiciones");
    fetchData(clientId, selectedYear);

    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    if (clientId) {
      params.set("client", clientId);
    } else {
      params.delete("client");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleYearChange = (year: number | null) => {
    setSelectedYear(year);
    fetchData(selectedClient, year);

    const params = new URLSearchParams(searchParams.toString());
    if (year) {
      params.set("year", String(year));
    } else {
      params.delete("year");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handlePageChange = (page: number) => {
    fetchData(selectedClient, selectedYear, page);
  };

  // KPIs
  const totalValue = useMemo(
    () => positions.reduce((sum, p) => sum + (p.position_value ?? 0), 0),
    [positions]
  );

  const totalCost = useMemo(
    () =>
      positions.reduce(
        (sum, p) => sum + (p.units ?? 0) * (p.avg_cost ?? 0),
        0
      ),
    [positions]
  );

  const pnl = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

  const latestDate = useMemo(() => {
    if (positions.length === 0) return "Sin datos";
    return new Date(positions[0].snapshot_date).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [positions]);

  const kpis = [
    {
      title: "Patrimonio",
      value: formatEur(totalValue),
      subtitle: selectedClient ? "Valor de mercado" : `AUM Total (${aumData.totalAccounts} cuentas)`,
      icon: Wallet,
      className: "text-rowell-navy",
    },
    {
      title: "Rendimiento",
      value: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%`,
      subtitle: `P&L: ${formatEur(totalValue - totalCost)}`,
      icon: TrendingUp,
      className: pnl >= 0 ? "text-green-600" : "text-red-600",
    },
    {
      title: "Posiciones",
      value: String(positions.length),
      subtitle: "Activos en cartera",
      icon: BarChart3,
      className: "text-rowell-navy",
    },
    {
      title: "Ultimo Corte",
      value: latestDate,
      subtitle: selectedYear ? `Ano ${selectedYear}` : "Todos los periodos",
      icon: Clock,
      className: "text-rowell-navy text-lg",
    },
  ];

  return (
    <div
      className={`space-y-6 ${loading ? "opacity-60 pointer-events-none" : ""}`}
    >
      {/* ================================================================= */}
      {/* Header                                                             */}
      {/* ================================================================= */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-rowell-navy sm:text-3xl">
            Panel de Administracion
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {clientName}
            {selectedClient && (
              <button
                onClick={() => handleClientChange(null)}
                className="ml-2 text-xs text-rowell-gold hover:underline"
              >
                (ver todos)
              </button>
            )}
          </p>
        </div>

        {/* Filtros de ano */}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-gray-400" />
          <div className="flex gap-0.5">
            <button
              onClick={() => handleYearChange(null)}
              className={`rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedYear === null
                  ? "bg-rowell-navy text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Todo
            </button>
            {availableYears.map((year, i) => (
              <button
                key={year}
                onClick={() => handleYearChange(year)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  i === availableYears.length - 1 ? "rounded-r-lg" : ""
                } ${
                  selectedYear === year
                    ? "bg-rowell-navy text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Selector de cliente                                                */}
      {/* ================================================================= */}
      <Card className="border bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-rowell-navy">
              <Users className="h-4 w-4" />
              Clientes ({clients.length})
            </CardTitle>
            {/* Buscador */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-rowell-navy focus:bg-white focus:outline-none focus:ring-1 focus:ring-rowell-navy"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {/* Boton "Todos" */}
            <button
              onClick={() => handleClientChange(null)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                !selectedClient
                  ? "bg-rowell-navy text-white shadow-md"
                  : "bg-gray-50 text-gray-600 hover:bg-rowell-navy/5 hover:text-rowell-navy"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Todos
              </div>
              <p className="mt-0.5 text-[10px] opacity-70">
                {totalAccounts} cuentas
              </p>
            </button>

            {filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => handleClientChange(client.id)}
                className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-all ${
                  selectedClient === client.id
                    ? "bg-rowell-navy text-white shadow-md"
                    : "bg-gray-50 text-gray-600 hover:bg-rowell-navy/5 hover:text-rowell-navy"
                }`}
              >
                <div className="font-medium">{client.name}</div>
                <p className="mt-0.5 text-[10px] opacity-70">
                  {client.accounts.length} cartera{client.accounts.length !== 1 ? "s" : ""}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* KPIs                                                               */}
      {/* ================================================================= */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.title} className="border bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-xs font-medium text-gray-500">
                  {kpi.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-rowell-gold" />
              </CardHeader>
              <CardContent>
                <p className={`text-xl font-bold ${kpi.className} sm:text-2xl`}>
                  {kpi.value}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {kpi.subtitle}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* ================================================================= */}
      {/* Graficos                                                           */}
      {/* ================================================================= */}
      {history.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-rowell-navy">
                Evolucion Patrimonial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EvolutionChart data={history} />
            </CardContent>
          </Card>

          <Card className="border bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-rowell-navy">
                Distribucion por Gestora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DistributionChart positions={positions} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* Tabs: Posiciones / Operaciones                                     */}
      {/* ================================================================= */}
      <Card className="border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-4 border-b">
            <button
              onClick={() => setActiveTab("posiciones")}
              className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === "posiciones"
                  ? "border-rowell-navy text-rowell-navy"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Posiciones ({positions.length})
            </button>
            <button
              onClick={() => setActiveTab("operaciones")}
              className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === "operaciones"
                  ? "border-rowell-navy text-rowell-navy"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <FileText className="h-4 w-4" />
              Operaciones ({operations.total})
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === "posiciones" ? (
            <PositionsTable positions={positions} />
          ) : (
            <div className="space-y-4">
              {operations.operations.length === 0 ? (
                <p className="py-8 text-center text-gray-400">
                  {selectedClient
                    ? "No hay operaciones para el periodo seleccionado."
                    : "Selecciona un cliente para ver sus operaciones."}
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase text-gray-500">
                          <th className="w-8 px-3 py-2"></th>
                          <th className="px-3 py-2">Fecha</th>
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2">Producto</th>
                          <th className="px-3 py-2 text-right">Titulos</th>
                          <th className="px-3 py-2 text-right">Importe EUR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {operations.operations.map((op: Operation) => (
                          <tr
                            key={op.id}
                            className="border-b last:border-0 hover:bg-gray-50"
                          >
                            <td className="px-3 py-2">
                              {getOpIcon(op.operation_type)}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {formatDate(op.operation_date)}
                            </td>
                            <td
                              className={`px-3 py-2 text-xs font-medium ${getOpColor(
                                op.operation_type
                              )}`}
                            >
                              {op.operation_type ?? "\u2014"}
                            </td>
                            <td className="max-w-[200px] truncate px-3 py-2 text-xs">
                              {op.product_name ?? "\u2014"}
                            </td>
                            <td className="px-3 py-2 text-right text-xs">
                              {op.units != null
                                ? op.units.toLocaleString("es-ES", {
                                    maximumFractionDigits: 4,
                                  })
                                : "\u2014"}
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-semibold">
                              {op.eur_amount != null
                                ? formatEur2(op.eur_amount)
                                : "\u2014"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {operations.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t pt-3">
                      <p className="text-xs text-gray-400">
                        {operations.total} operaciones
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePageChange(opsPage - 1)}
                          disabled={opsPage <= 1}
                          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="px-2 text-xs text-gray-500">
                          {opsPage} / {operations.totalPages}
                        </span>
                        <button
                          onClick={() => handlePageChange(opsPage + 1)}
                          disabled={opsPage >= operations.totalPages}
                          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
