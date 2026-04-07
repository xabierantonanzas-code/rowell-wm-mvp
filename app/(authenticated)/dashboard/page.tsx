import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getLatestPositions,
  getPositionHistory,
  getAggregatedPositions,
  getAggregatedHistory,
  getAvailableDateRange,
  getHistoryByAccount,
} from "@/lib/queries/positions";
import type { DateRange } from "@/lib/queries/positions";
import { getOperations, getAllOperationsForAccounts } from "@/lib/queries/operations";
import { getCashBalances } from "@/lib/queries/balances";
import { getClientAccounts } from "@/lib/queries/clients";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import ClientDashboard from "@/components/dashboard/ClientDashboard";
import OperationalDashboard from "@/components/admin/OperationalDashboard";

// ===========================================================================
// Dashboard
// ===========================================================================

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Admin/Owner: panel operativo
  if (user.app_metadata?.role === "admin" || user.app_metadata?.role === "owner") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-rowell-navy sm:text-3xl">
            Dashboard Operativo
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Actividad, usuarios, seguridad y sistema
          </p>
        </div>
        <OperationalDashboard isOwner={user.app_metadata?.role === "owner"} />
      </div>
    );
  }

  // Obtener cuentas del cliente
  const accounts = await getClientAccounts(user.email ?? "");

  if (!accounts || accounts.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-rowell-navy">
            Mi Cartera
          </h1>
          <p className="mt-1 text-gray-500">
            Bienvenido, {user.email}
          </p>
        </div>

        <Card className="border bg-white shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="text-gray-400">
              No tienes carteras asignadas todavia.
            </p>
            <p className="mt-1 text-sm text-gray-300">
              Contacta con tu asesor para activar tu cuenta.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Parsear filtros de URL
  const dateFromParam = typeof params.dateFrom === "string" ? params.dateFrom : undefined;
  const dateToParam = typeof params.dateTo === "string" ? params.dateTo : undefined;
  const accountParam = typeof params.account === "string" ? params.account : undefined;

  const dateRange: DateRange | undefined =
    dateFromParam || dateToParam ? { dateFrom: dateFromParam, dateTo: dateToParam } : undefined;

  // Determinar cuentas activas
  const accountIds = accounts.map((a) => a.id);
  const selectedAccountId = accountParam && accountIds.includes(accountParam)
    ? accountParam
    : undefined;

  const activeAccountIds = selectedAccountId
    ? [selectedAccountId]
    : accountIds;

  const isSingle = activeAccountIds.length === 1;
  const primaryAccountId = activeAccountIds[0];

  // Fetch datos en paralelo. MVP6 #6: traemos TODAS las operations (sin
  // paginar) porque los useMemo del componente calculan netContributions,
  // FIFO eur cost y productTypeMap sobre el historico completo. Antes se
  // traian solo 25 paginadas y rompia los KPIs en clientes con muchos
  // movimientos.
  const [positions, history, allOps, availableDateRange] = await Promise.all([
    isSingle
      ? getLatestPositions(primaryAccountId, dateRange)
      : getAggregatedPositions(activeAccountIds, dateRange),
    isSingle
      ? getPositionHistory(primaryAccountId, dateRange)
      : getAggregatedHistory(activeAccountIds, dateRange),
    getAllOperationsForAccounts(activeAccountIds, dateRange),
    getAvailableDateRange(accountIds),
  ]);

  const PAGE_SIZE = 25;
  const opsResult = {
    operations: allOps.slice(0, PAGE_SIZE),
    total: allOps.length,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(allOps.length / PAGE_SIZE)),
  };

  // Cash balance
  let cashBalance = 0;
  if (isSingle) {
    const balances = await getCashBalances(primaryAccountId);
    cashBalance = balances.reduce((sum, b) => sum + (b.balance ?? 0), 0);
  }

  // Per-account history (for strategy chart, multi-account)
  let historyByAccount: Record<string, { date: string; totalValue: number }[]> | undefined;
  if (!isSingle) {
    const histMap = await getHistoryByAccount(activeAccountIds, dateRange);
    historyByAccount = Object.fromEntries(histMap);
  }

  // Nombre del cliente
  const clientName = accounts[0].clients?.full_name ?? user.email ?? "Mi Cartera";

  const initialData = {
    accountId: isSingle ? primaryAccountId : "all",
    dateFrom: dateFromParam ?? null,
    dateTo: dateToParam ?? null,
    positions,
    history,
    historyByAccount,
    // MVP6 #6: TODAS las ops para los useMemo del componente
    operations: {
      operations: allOps,
      total: allOps.length,
      page: 1,
      totalPages: opsResult.totalPages,
    },
    cashBalance,
  };

  const accountOptions = accounts.map((a) => ({
    id: a.id,
    account_number: a.account_number,
    label: a.label,
  }));

  const clientId = accounts[0].clients?.id ?? undefined;

  return (
    <ClientDashboard
      clientName={clientName}
      clientId={clientId}
      accounts={accountOptions}
      availableDateRange={availableDateRange}
      initialData={initialData}
      fetchUrl="/api/dashboard"
    />
  );
}
