"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Position, Operation } from "@/lib/types/database";
import { useUser } from "@/lib/hooks/useUser";
import SystemPanel from "@/components/admin/SystemPanel";
import InviteClientModal from "@/components/admin/InviteClientModal";
import { Mail } from "lucide-react";
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
import CommunicationPanel from "@/components/dashboard/CommunicationPanel";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

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

interface InvitationInfo {
  clientId: string;
  status: "none" | "pending" | "confirmed";
}

interface AdminDashboardProps {
  clients: ClientInfo[];
  unassignedAccounts: { id: string; account_number: string; label: string | null }[];
  selectedClientId: string | null;
  aumData: AumData;
  availableDateRange: { minDate: string; maxDate: string } | null;
  initialDateFrom: string | null;
  initialDateTo: string | null;
  initialPositions: Position[];
  initialHistory: HistoryPoint[];
  initialOperations: OperationsData;
  activeClientName: string;
  totalAccounts: number;
  invitations?: InvitationInfo[];
  selectorOnly?: boolean;
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
// Sub-component: Client Dropdown with search
// ===========================================================================

function ClientDropdown({
  clients,
  filteredClients,
  selectedClient,
  searchQuery,
  setSearchQuery,
  totalAccounts,
  onSelect,
}: {
  clients: ClientInfo[];
  filteredClients: ClientInfo[];
  selectedClient: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  totalAccounts: number;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const selectedName = selectedClient
    ? clients.find((c) => c.id === selectedClient)?.name ?? "Cliente"
    : "Todos los clientes";

  const selectedAccounts = selectedClient
    ? clients.find((c) => c.id === selectedClient)?.accounts.length ?? 0
    : totalAccounts;

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(!open); setSearchQuery(""); }}
        className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-all hover:border-[#C9A84C]/50 hover:shadow-md"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B1D3A]/5">
            <Users className="h-4 w-4 text-[#0B1D3A]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[#0B1D3A]">{selectedName}</p>
            <p className="text-xs text-gray-400">
              {selectedAccounts} cartera{selectedAccounts !== 1 ? "s" : ""} · {clients.length} clientes total
            </p>
          </div>
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[420px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {/* Search input */}
          <div className="border-b border-gray-100 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar por nombre, alias o cuenta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-[#C9A84C] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-[340px] overflow-y-auto">
            {/* "Todos" option */}
            <button
              onClick={() => { onSelect(null); setOpen(false); }}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F5F3EE] ${
                !selectedClient ? "bg-[#0B1D3A]/5" : ""
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C9A84C]/10">
                <Users className="h-4 w-4 text-[#C9A84C]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#0B1D3A]">Todos los clientes</p>
                <p className="text-xs text-gray-400">{totalAccounts} cuentas</p>
              </div>
              {!selectedClient && (
                <div className="h-2 w-2 rounded-full bg-[#C9A84C]" />
              )}
            </button>

            <div className="h-px bg-gray-100" />

            {filteredClients.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">
                No se encontraron clientes
              </p>
            ) : (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => { onSelect(client.id); setOpen(false); }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#F5F3EE] ${
                    selectedClient === client.id ? "bg-[#0B1D3A]/5" : ""
                  }`}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#0B1D3A]/5 text-xs font-semibold text-[#0B1D3A]">
                    {client.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {client.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {client.accounts.length} cartera{client.accounts.length !== 1 ? "s" : ""}
                      {client.accounts[0]?.label ? ` · ${client.accounts[0].label}` : ""}
                    </p>
                  </div>
                  {selectedClient === client.id && (
                    <div className="h-2 w-2 flex-shrink-0 rounded-full bg-[#C9A84C]" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Component
// ===========================================================================

export default function AdminDashboard({
  clients,
  unassignedAccounts,
  selectedClientId,
  aumData,
  availableDateRange,
  initialDateFrom,
  initialDateTo,
  initialPositions,
  initialHistory,
  initialOperations,
  activeClientName,
  totalAccounts,
  invitations = [],
  selectorOnly = false,
}: AdminDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isOwner: currentUserIsOwner } = useUser();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // State
  const [selectedClient, setSelectedClient] = useState<string | null>(
    selectedClientId
  );
  const [dateFrom, setDateFrom] = useState<string | undefined>(initialDateFrom ?? undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(initialDateTo ?? undefined);
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
  const [selectedAccountId, setSelectedAccountId] = useState<string | "all">("all");

  // Sync state when server props change (e.g. after navigation)
  useEffect(() => {
    setSelectedClient(selectedClientId);
    setPositions(initialPositions);
    setHistory(initialHistory);
    setOperations(initialOperations);
    setClientName(activeClientName);
    setDateFrom(initialDateFrom ?? undefined);
    setDateTo(initialDateTo ?? undefined);
    setSelectedAccountId("all");
    setLoading(false);
  }, [selectedClientId, initialPositions, initialHistory, initialOperations, activeClientName, initialDateFrom, initialDateTo]);

  // Current client's accounts for the sub-filter
  const currentClientAccounts = useMemo(() => {
    if (!selectedClient) return [];
    const cl = clients.find((c) => c.id === selectedClient);
    return cl?.accounts ?? [];
  }, [selectedClient, clients]);

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
    df: string | undefined,
    dt: string | undefined,
    page: number = 1,
    accountFilter: string | "all" = "all"
  ) => {
    // For "all clients", use server-side navigation to avoid URL overflow
    if (!clientId) {
      const params = new URLSearchParams();
      if (df) params.set("dateFrom", df);
      if (dt) params.set("dateTo", dt);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
      router.refresh();
      return;
    }

    setLoading(true);
    try {
      const cl = clients.find((c) => c.id === clientId);
      let accountIds: string[];

      if (accountFilter !== "all") {
        accountIds = [accountFilter];
      } else {
        accountIds = cl ? cl.accounts.map((a) => a.id) : [];
      }

      if (accountIds.length === 0) {
        setPositions([]);
        setHistory([]);
        setOperations({ operations: [], total: 0, page: 1, totalPages: 0 });
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (df) params.set("dateFrom", df);
      if (dt) params.set("dateTo", dt);
      params.set("page", String(page));

      if (accountIds.length === 1) {
        params.set("account", accountIds[0]);
      } else {
        params.set("accounts", JSON.stringify(accountIds));
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
    setSelectedAccountId("all");
    const cl = clientId ? clients.find((c) => c.id === clientId) : null;
    setClientName(cl ? cl.name : "Todos los Clientes");
    setActiveTab("posiciones");

    if (!clientId) {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      router.push(`${pathname}?${params.toString()}`);
      return;
    }

    fetchData(clientId, dateFrom, dateTo, 1, "all");

    const params = new URLSearchParams(searchParams.toString());
    params.set("client", clientId);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleAccountChange = (accountId: string | "all") => {
    setSelectedAccountId(accountId);
    fetchData(selectedClient, dateFrom, dateTo, 1, accountId);
  };

  const handleDateChange = (newDateFrom: string | undefined, newDateTo: string | undefined) => {
    setDateFrom(newDateFrom);
    setDateTo(newDateTo);
    fetchData(selectedClient, newDateFrom, newDateTo, 1, selectedAccountId);

    const params = new URLSearchParams(searchParams.toString());
    if (newDateFrom) {
      params.set("dateFrom", newDateFrom);
    } else {
      params.delete("dateFrom");
    }
    if (newDateTo) {
      params.set("dateTo", newDateTo);
    } else {
      params.delete("dateTo");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handlePageChange = (page: number) => {
    fetchData(selectedClient, dateFrom, dateTo, page, selectedAccountId);
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

  const isinCount = useMemo(
    () => new Set(positions.map((p) => p.isin).filter(Boolean)).size,
    [positions]
  );

  // Aportaciones netas, comisiones (from operations)
  const { netContributions, totalCommissions, totalRetentions } = useMemo(() => {
    let contributions = 0, withdrawals = 0, commissions = 0, retentions = 0;
    for (const op of operations.operations) {
      const amount = Math.abs(op.eur_amount ?? 0);
      const t = (op.operation_type ?? "").toLowerCase();
      if (t.includes("compra") || t.includes("suscripci")) contributions += amount;
      else if (t.includes("venta") || t.includes("reembolso")) withdrawals += amount;
      commissions += op.commission ?? 0;
      retentions += op.withholding ?? 0;
    }
    return { netContributions: contributions - withdrawals, totalCommissions: commissions, totalRetentions: retentions };
  }, [operations.operations]);

  const plusvaliaTotalEco = totalValue - netContributions;

  const { concTop5, concTop10 } = useMemo(() => {
    if (positions.length === 0 || totalValue === 0) return { concTop5: 0, concTop10: 0 };
    const sorted = [...positions].sort((a, b) => (b.position_value ?? 0) - (a.position_value ?? 0));
    const top5 = sorted.slice(0, 5).reduce((s, p) => s + (p.position_value ?? 0), 0);
    const top10 = sorted.slice(0, 10).reduce((s, p) => s + (p.position_value ?? 0), 0);
    return { concTop5: (top5 / totalValue) * 100, concTop10: (top10 / totalValue) * 100 };
  }, [positions, totalValue]);

  const rentabilidadPeriods = useMemo(() => {
    if (history.length === 0 || totalValue === 0) return [];
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
      if (p.label === "ALL") targetDate = history[0].date;
      else if ("yearStart" in p && p.yearStart) targetDate = `${now.getFullYear()}-01-01`;
      else { const d = new Date(now); d.setDate(d.getDate() - (p.daysAgo ?? 0)); targetDate = d.toISOString().split("T")[0]; }
      const closest = history.find((h) => h.date >= targetDate) ?? history[0];
      const startValue = closest.totalValue;
      if (startValue > 0) {
        const returnEur = totalValue - startValue;
        return { period: p.label, returnPct: (returnEur / startValue) * 100, returnEur };
      }
      return { period: p.label, returnPct: 0, returnEur: 0 };
    });
  }, [history, totalValue]);

  const flowsByMonth = useMemo(() => {
    const map = new Map<string, { compras: number; ventas: number }>();
    for (const op of operations.operations) {
      if (!op.operation_date) continue;
      const d = new Date(op.operation_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { compras: 0, ventas: 0 });
      const entry = map.get(key)!;
      const t = (op.operation_type ?? "").toLowerCase();
      const amount = Math.abs(op.eur_amount ?? 0);
      if (t.includes("compra") || t.includes("suscripci")) entry.compras += amount;
      else if (t.includes("venta") || t.includes("reembolso")) entry.ventas += amount;
    }
    let cumNet = 0;
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, d]) => {
      cumNet += d.compras - d.ventas;
      return { month: new Date(month + "-01").toLocaleDateString("es-ES", { month: "short", year: "2-digit" }), Compras: d.compras, Ventas: d.ventas, "Neto acum.": cumNet };
    });
  }, [operations.operations]);

  const patrimonioVsAportaciones = useMemo(() => {
    if (history.length === 0) return [];
    const opsByDate = new Map<string, number>();
    let cumContrib = 0;
    const ops = [...operations.operations].sort((a, b) => (a.operation_date ?? "").localeCompare(b.operation_date ?? ""));
    for (const op of ops) {
      if (!op.operation_date) continue;
      const t = (op.operation_type ?? "").toLowerCase();
      const amount = Math.abs(op.eur_amount ?? 0);
      if (t.includes("compra") || t.includes("suscripci")) cumContrib += amount;
      else if (t.includes("venta") || t.includes("reembolso")) cumContrib -= amount;
      opsByDate.set(op.operation_date, cumContrib);
    }
    let lastContrib = 0;
    const opEntries = Array.from(opsByDate.entries());
    return history.map((h) => {
      for (const [date, val] of opEntries) { if (date <= h.date) lastContrib = val; }
      return { date: new Date(h.date).toLocaleDateString("es-ES", { month: "short", year: "2-digit" }), Patrimonio: h.totalValue, "Aportaciones netas": Math.max(0, lastContrib) };
    });
  }, [history, operations.operations]);

  const kpis = [
    {
      label: "Patrimonio total",
      value: formatEur(totalValue),
      sub: selectedClient ? `Coste: ${formatEur(totalCost)}` : `AUM Total (${aumData.totalAccounts} cuentas)`,
      accent: false,
    },
    {
      label: "Patrimonio invertido",
      value: formatEur(totalValue),
      sub: `${positions.length} posiciones`,
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
      value: String(positions.length),
      sub: "Activos en cartera",
      accent: false,
    },
    {
      label: "N° ISINs",
      value: String(isinCount),
      sub: `${isinCount} instrumentos unicos`,
      accent: false,
    },
    {
      label: "Clientes",
      value: String(clients.length),
      sub: `${totalAccounts} cuentas totales`,
      accent: false,
    },
    {
      label: "Ultimo corte",
      value: latestDate,
      sub: dateFrom || dateTo ? `${dateFrom ?? "..."} — ${dateTo ?? "..."}` : "Todos los periodos",
      accent: false,
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

        {/* Filtro de fechas */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Calendar className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <input
            type="date"
            value={dateFrom ?? ""}
            min={availableDateRange?.minDate}
            max={dateTo || availableDateRange?.maxDate}
            onChange={(e) => handleDateChange(e.target.value || undefined, dateTo)}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-medium text-gray-700 shadow-sm focus:border-rowell-navy focus:outline-none focus:ring-1 focus:ring-rowell-navy sm:flex-none sm:py-1.5"
          />
          <span className="text-xs text-gray-400">—</span>
          <input
            type="date"
            value={dateTo ?? ""}
            min={dateFrom || availableDateRange?.minDate}
            max={availableDateRange?.maxDate}
            onChange={(e) => handleDateChange(dateFrom, e.target.value || undefined)}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-medium text-gray-700 shadow-sm focus:border-rowell-navy focus:outline-none focus:ring-1 focus:ring-rowell-navy sm:flex-none sm:py-1.5"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => handleDateChange(undefined, undefined)}
              className="rounded-lg bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-200 transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Invite button */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
      {/* ================================================================= */}
      {/* Selector de cliente — Dropdown con búsqueda                        */}
      {/* ================================================================= */}
      <ClientDropdown
        clients={clients}
        filteredClients={filteredClients}
        selectedClient={selectedClient}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalAccounts={totalAccounts}
        onSelect={handleClientChange}
      />
        </div>
        <button
          onClick={() => setInviteModalOpen(true)}
          className="flex flex-shrink-0 items-center gap-2 rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-4 py-3 text-sm font-medium text-[#0B1D3A] transition-colors hover:bg-[#C9A84C]/20"
        >
          <Mail className="h-4 w-4 text-[#C9A84C]" />
          <span className="hidden sm:inline">Invitar cliente</span>
        </button>
      </div>

      {/* Invite modal */}
      <InviteClientModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        clients={clients.map((c) => {
          const inv = invitations.find((i) => i.clientId === c.id);
          return {
            id: c.id,
            name: c.name,
            email: c.email,
            hasAccess: inv?.status === "confirmed",
            inviteStatus: inv?.status ?? "none",
          };
        })}
      />

      {/* Sub-filtro de carteras dentro del cliente */}
      {selectedClient && currentClientAccounts.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-400">Carteras:</span>
          <button
            onClick={() => handleAccountChange("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              selectedAccountId === "all"
                ? "bg-[#0B1D3A] text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Todas ({currentClientAccounts.length})
          </button>
          {currentClientAccounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => handleAccountChange(acc.id)}
              className={`rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-all ${
                selectedAccountId === acc.id
                  ? "bg-[#0B1D3A] text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>{acc.label || `...${acc.account_number.slice(-8)}`}</span>
            </button>
          ))}
        </div>
      )}

      {/* If selectorOnly, stop here — ClientDashboard renders below */}
      {selectorOnly ? null : (
      <>

      {/* ================================================================= */}
      {/* KPIs                                                               */}
      {/* ================================================================= */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
      </section>

      {/* ================================================================= */}
      {/* Rentabilidad + Concentración + Costes (solo con cliente)           */}
      {/* ================================================================= */}
      {selectedClient && (rentabilidadPeriods.length > 0 || positions.length > 0) && (
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {rentabilidadPeriods.map((r) => (
            <div key={r.period} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#C9A84C] to-[#E8C870] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Rent. {r.period}</p>
              <p className={`mt-1 text-lg font-bold ${r.returnPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                {r.returnPct >= 0 ? "+" : ""}{r.returnPct.toFixed(2)}%
              </p>
              <p className="text-[10px] text-gray-400">{r.returnEur >= 0 ? "+" : ""}{formatEur(r.returnEur)}</p>
            </div>
          ))}
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#C9A84C] to-[#E8C870] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Plusvalia total economica</p>
            <p className={`mt-1 text-lg font-bold ${plusvaliaTotalEco >= 0 ? "text-green-600" : "text-red-600"}`}>
              {plusvaliaTotalEco >= 0 ? "+" : ""}{formatEur(plusvaliaTotalEco)}
            </p>
            <p className="text-[10px] text-gray-400">Patrimonio - aportaciones netas</p>
          </div>
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#C9A84C] to-[#E8C870] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Concentracion</p>
            <p className="mt-1 text-lg font-bold text-[#0B1D3A]">Top 5: {concTop5.toFixed(1)}%</p>
            <p className="text-[10px] text-gray-400">Top 10: {concTop10.toFixed(1)}%</p>
          </div>
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#C9A84C] to-[#E8C870] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Costes acumulados</p>
            <p className="mt-1 text-lg font-bold text-[#0B1D3A]">{formatEur(totalCommissions + totalRetentions)}</p>
            <p className="text-[10px] text-gray-400">Com: {formatEur(totalCommissions)} · Ret: {formatEur(totalRetentions)}</p>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* Graficos                                                           */}
      {/* ================================================================= */}
      {history.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Patrimonio vs Aportaciones */}
          {selectedClient && patrimonioVsAportaciones.length > 0 ? (
            <Card className="border bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-rowell-navy">
                  Patrimonio vs Aportaciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={patrimonioVsAportaciones}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                    <YAxis tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} tick={{ fontSize: 10, fill: "#9ca3af" }} width={55} />
                    <Tooltip formatter={(value: number, name: string) => [formatEur(value), name]} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Area type="monotone" dataKey="Aportaciones netas" fill="#059669" fillOpacity={0.15} stroke="#059669" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="Patrimonio" fill="#0B1D3A" fillOpacity={0.08} stroke="#0B1D3A" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
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
          )}

          {/* Flujos netos o Distribución */}
          {selectedClient && flowsByMonth.length > 0 ? (
            <Card className="border bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-rowell-navy">
                  Flujos Netos por Mes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={flowsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                    <YAxis yAxisId="bars" tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} tick={{ fontSize: 10, fill: "#9ca3af" }} width={55} />
                    <YAxis yAxisId="line" orientation="right" tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} tick={{ fontSize: 10, fill: "#C9A84C" }} width={55} />
                    <Tooltip formatter={(value: number, name: string) => [formatEur(value), name]} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar yAxisId="bars" dataKey="Compras" fill="#059669" radius={[2, 2, 0, 0]} />
                    <Bar yAxisId="bars" dataKey="Ventas" fill="#dc2626" radius={[2, 2, 0, 0]} />
                    <Line yAxisId="line" type="monotone" dataKey="Neto acum." stroke="#C9A84C" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
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
          )}
        </div>
      )}

      {/* Distribución + Evolución (when client selected, show both below) */}
      {selectedClient && history.length > 0 && (
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

      {/* ================================================================= */}
      {/* Espacio Personal — solo cuando hay un cliente seleccionado          */}
      {/* ================================================================= */}
      {selectedClient && (
        <div className="space-y-4">
          <div className="relative mb-2 mt-2">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#0B1D3A] to-[#1a3a5c] opacity-90" />
            <h2 className="relative px-6 py-3 font-display text-lg font-bold text-white">
              5. Espacio Personal
            </h2>
          </div>
          <CommunicationPanel
            clientId={selectedClient}
            clientName={clientName}
            isAdmin
          />
        </div>
      )}

      </>
      )}

      {/* Sistema — solo visible para owner */}
      {currentUserIsOwner && !selectorOnly && <SystemPanel />}
    </div>
  );
}
