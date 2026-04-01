"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Shield,
  ShieldAlert,
  Activity,
  FileText,
  Upload,
  Mail,
  HardDrive,
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Heart,
} from "lucide-react";

// ===========================================================================
// Types
// ===========================================================================

interface StatsData {
  activeUsersWeek: number;
  loginSuccesses7d: number;
  loginFailures7d: number;
  blockedIPs7d: number;
  totalClients: number;
  clientsWithAccess: number;
  clientsWithoutAccess: number;
  pendingInvites: number;
  confirmedInvites: number;
  totalPositions: number;
  totalDocuments: number;
  storageUsedMB: number;
  recentUploads: number;
  recentLogins: {
    email: string;
    ip: string;
    action: string;
    success: boolean;
    date: string;
  }[];
  recentDocuments: { id: string; sizeMB: number; date: string }[];
  invitations: { email: string; status: string; invitedAt: string; confirmedAt: string | null }[];
}

interface HealthData {
  status: string;
  totalMs: number;
  checks: Record<string, { ok: boolean; ms: number }>;
}

// ===========================================================================
// Helpers
// ===========================================================================

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

export default function OperationalDashboard({ isOwner = false }: { isOwner?: boolean }) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => (r.ok ? r.json() : null)),
      isOwner ? fetch("/api/health").then((r) => (r.ok ? r.json() : null)) : Promise.resolve(null),
    ])
      .then(([s, h]) => {
        setStats(s);
        setHealth(h);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700">
        No se pudieron cargar las estadisticas. Las tablas security_logs o invitations pueden no estar creadas.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Health Status — solo owner */}
      {isOwner && health && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
            health.status === "healthy"
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <Heart
            className={`h-4 w-4 ${
              health.status === "healthy" ? "text-green-600" : "text-red-600"
            }`}
          />
          <span
            className={`text-sm font-medium ${
              health.status === "healthy" ? "text-green-700" : "text-red-700"
            }`}
          >
            Sistema {health.status === "healthy" ? "operativo" : "con problemas"}
          </span>
          <span className="text-xs text-gray-400">
            DB: {health.checks.database?.ms ?? "?"}ms · Auth: {health.checks.auth?.ms ?? "?"}ms
          </span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {/* Visible para admin + owner */}
        <KpiCard
          icon={Users}
          label="Usuarios activos (7d)"
          value={String(stats.activeUsersWeek)}
          sub={`${stats.loginSuccesses7d} logins exitosos`}
        />
        <KpiCard
          icon={Users}
          label="Clientes totales"
          value={String(stats.totalClients)}
          sub={`${stats.clientsWithAccess} con acceso · ${stats.clientsWithoutAccess} sin acceso`}
        />
        <KpiCard
          icon={FileText}
          label="Documentos"
          value={String(stats.totalDocuments)}
          sub={`${stats.storageUsedMB} MB usado`}
        />
        <KpiCard
          icon={Mail}
          label="Invitaciones"
          value={String(stats.pendingInvites + stats.confirmedInvites)}
          sub={`${stats.pendingInvites} pendientes · ${stats.confirmedInvites} confirmadas`}
        />

        {/* Solo owner */}
        {isOwner && (
          <>
            <KpiCard
              icon={Shield}
              label="Logins fallidos (7d)"
              value={String(stats.loginFailures7d)}
              sub={`${stats.blockedIPs7d} IPs bloqueadas`}
              alert={stats.loginFailures7d > 10}
            />
            <KpiCard
              icon={Database}
              label="Posiciones en DB"
              value={stats.totalPositions.toLocaleString("es-ES")}
              sub="Datos financieros cargados"
            />
            <KpiCard
              icon={Upload}
              label="Uploads recientes"
              value={String(stats.recentUploads)}
              sub="Cargas de Excel"
            />
            <KpiCard
              icon={HardDrive}
              label="Storage"
              value={`${stats.storageUsedMB} MB`}
              sub={`de 1.000 MB (${((stats.storageUsedMB / 1000) * 100).toFixed(1)}%)`}
            />
          </>
        )}
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Logins */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
            <Activity className="h-4 w-4 text-[#C9A84C]" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0B1D3A]">
              Ultimos accesos
            </h3>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {stats.recentLogins.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-gray-400">
                Sin datos de accesos (ejecutar migration security_logs)
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-[10px] uppercase text-gray-400">
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentLogins.map((login, i) => (
                    <tr
                      key={i}
                      className={`border-b last:border-0 ${
                        !login.success ? "bg-red-50/50" : ""
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-[10px] text-gray-500">
                        {formatDate(login.date)}
                      </td>
                      <td className="max-w-[150px] truncate px-3 py-2 text-gray-700">
                        {login.email ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {login.success ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Invitations */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
            <Mail className="h-4 w-4 text-[#C9A84C]" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0B1D3A]">
              Invitaciones
            </h3>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {stats.invitations.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-gray-400">
                Ninguna invitacion enviada
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-[10px] uppercase text-gray-400">
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.invitations.map((inv, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="max-w-[180px] truncate px-3 py-2 text-gray-700">
                        {inv.email}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            inv.status === "confirmed"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {inv.status === "confirmed" ? "Activo" : "Pendiente"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-gray-500">
                        {formatDate(inv.invitedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-component: KPI Card
// ===========================================================================

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  alert = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        alert ? "border-red-200" : "border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${alert ? "text-red-500" : "text-[#C9A84C]"}`} />
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {label}
        </p>
      </div>
      <p className={`mt-1 text-xl font-bold ${alert ? "text-red-600" : "text-[#0B1D3A]"}`}>
        {value}
      </p>
      <p className="text-[10px] text-gray-400">{sub}</p>
    </div>
  );
}
