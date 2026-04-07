"use client";

import { useState, useEffect } from "react";
import { Shield, Zap, AlertTriangle, DollarSign, Activity } from "lucide-react";

// ===========================================================================
// Types
// ===========================================================================

interface SecurityLog {
  id: string;
  ip: string;
  email: string | null;
  action: string;
  success: boolean;
  created_at: string;
}

interface TokenSummary {
  totalInput: number;
  totalOutput: number;
  totalCost: number;
  totalCalls: number;
  byDay: { date: string; input: number; output: number; cost: number }[];
  byEndpoint: { endpoint: string; input: number; output: number; cost: number; calls: number }[];
}

// ===========================================================================
// Helpers
// ===========================================================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ===========================================================================
// Component
// ===========================================================================

export default function SystemPanel() {
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [tokenData, setTokenData] = useState<TokenSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tokens" | "security">("tokens");

  useEffect(() => {
    Promise.all([
      fetch("/api/token-usage").then((r) => r.ok ? r.json() : null),
      fetch("/api/security-logs").then((r) => r.ok ? r.json() : []),
    ]).then(([tokens, logs]) => {
      setTokenData(tokens);
      setSecurityLogs(logs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const failedLogins = securityLogs.filter(
    (l) => l.action === "login_failed" || l.action === "login_blocked_rate_limit"
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#3D4F63] to-[#1a3a5c] opacity-90" />
        <h2 className="relative flex items-center gap-2 px-4 py-2.5 font-display text-sm font-bold text-white sm:px-6 sm:py-3 sm:text-lg">
          <Shield className="h-5 w-5 text-[#B8965A]" />
          Sistema (Solo Owner)
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab("tokens")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "tokens"
              ? "bg-white text-[#3D4F63] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Zap className="h-4 w-4" />
          Tokens y Costes
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "security"
              ? "bg-white text-[#3D4F63] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Logs de Seguridad
          {failedLogins.length > 0 && (
            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
              {failedLogins.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Cargando datos del sistema...</div>
      ) : activeTab === "tokens" ? (
        <TokensTab data={tokenData} />
      ) : (
        <SecurityTab logs={securityLogs} />
      )}
    </div>
  );
}

// ===========================================================================
// Tokens Tab
// ===========================================================================

function TokensTab({ data }: { data: TokenSummary | null }) {
  if (!data) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
        No hay datos de uso de tokens. La tabla token_usage puede no estar creada en Supabase.
      </div>
    );
  }

  const kpis = [
    {
      label: "Tokens Input",
      value: formatNumber(data.totalInput),
      icon: Activity,
      sub: `${data.totalCalls} llamadas`,
    },
    {
      label: "Tokens Output",
      value: formatNumber(data.totalOutput),
      icon: Zap,
      sub: `${formatNumber(data.totalInput + data.totalOutput)} total`,
    },
    {
      label: "Coste este mes",
      value: formatUsd(data.totalCost),
      icon: DollarSign,
      sub: `Input: $3/MTok · Output: $15/MTok`,
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <kpi.icon className="h-4 w-4 text-[#B8965A]" />
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                {kpi.label}
              </p>
            </div>
            <p className="mt-1 text-xl font-bold text-[#3D4F63]">{kpi.value}</p>
            <p className="text-[10px] text-gray-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* By Endpoint */}
      {data.byEndpoint.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#3D4F63]">
              Uso por Endpoint
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-[10px] uppercase text-gray-400">
                  <th className="px-4 py-2">Endpoint</th>
                  <th className="px-4 py-2 text-right">Llamadas</th>
                  <th className="px-4 py-2 text-right">Input</th>
                  <th className="px-4 py-2 text-right">Output</th>
                  <th className="px-4 py-2 text-right">Coste</th>
                </tr>
              </thead>
              <tbody>
                {data.byEndpoint.map((ep) => (
                  <tr key={ep.endpoint} className="border-b last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{ep.endpoint}</td>
                    <td className="px-4 py-2 text-right text-xs">{ep.calls}</td>
                    <td className="px-4 py-2 text-right text-xs">{formatNumber(ep.input)}</td>
                    <td className="px-4 py-2 text-right text-xs">{formatNumber(ep.output)}</td>
                    <td className="px-4 py-2 text-right text-xs font-semibold">{formatUsd(ep.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Security Tab
// ===========================================================================

function SecurityTab({ logs }: { logs: SecurityLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
        No hay logs de seguridad. La tabla security_logs puede no estar creada en Supabase.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#3D4F63]">
          Ultimos 100 eventos
        </h3>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b text-[10px] uppercase text-gray-400">
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">IP</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Accion</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className={`border-b last:border-0 ${
                  !log.success ? "bg-red-50/50" : ""
                }`}
              >
                <td className="px-4 py-2 font-mono text-[10px] text-gray-500">
                  {formatDate(log.created_at)}
                </td>
                <td className="px-4 py-2 font-mono text-[10px]">{log.ip}</td>
                <td className="px-4 py-2 text-xs">{log.email ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{log.action}</td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      log.success
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {log.success ? "OK" : "FAIL"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
