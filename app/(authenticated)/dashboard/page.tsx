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
import { getOperations } from "@/lib/queries/operations";
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
        <OperationalDashboard />
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

  // Fetch datos en paralelo
  const [positions, history, opsResult, availableDateRange] = await Promise.all([
    isSingle
      ? getLatestPositions(primaryAccountId, dateRange)
      : getAggregatedPositions(activeAccountIds, dateRange),
    isSingle
      ? getPositionHistory(primaryAccountId, dateRange)
      : getAggregatedHistory(activeAccountIds, dateRange),
    isSingle
      ? getOperations(primaryAccountId, { dateRange, page: 1, pageSize: 25 })
      : Promise.resolve({ operations: [] as any[], total: 0, page: 1, totalPages: 0, pageSize: 25 }),
    getAvailableDateRange(accountIds),
  ]);

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
    operations: {
      operations: opsResult.operations,
      total: opsResult.total,
      page: opsResult.page,
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
