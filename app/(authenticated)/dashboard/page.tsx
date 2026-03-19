import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getLatestPositions,
  getPositionHistory,
  getAggregatedPositions,
  getAggregatedHistory,
  getAvailableYears,
} from "@/lib/queries/positions";
import { getOperations } from "@/lib/queries/operations";
import { getCashBalances } from "@/lib/queries/balances";
import { getClientAccounts } from "@/lib/queries/clients";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import ClientDashboard from "@/components/dashboard/ClientDashboard";

// ===========================================================================
// Dashboard del Cliente
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

  // Si es admin, redirigir al panel admin
  if (user.app_metadata?.role === "admin") {
    redirect("/admin");
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
  const yearParam = typeof params.year === "string" ? parseInt(params.year, 10) : undefined;
  const accountParam = typeof params.account === "string" ? params.account : undefined;

  const year = yearParam && !isNaN(yearParam) ? yearParam : undefined;

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
  const [positions, history, opsResult, availableYears] = await Promise.all([
    isSingle
      ? getLatestPositions(primaryAccountId, year)
      : getAggregatedPositions(activeAccountIds, year),
    isSingle
      ? getPositionHistory(primaryAccountId, year)
      : getAggregatedHistory(activeAccountIds, year),
    isSingle
      ? getOperations(primaryAccountId, { year, page: 1, pageSize: 25 })
      : Promise.resolve({ operations: [] as any[], total: 0, page: 1, totalPages: 0, pageSize: 25 }),
    getAvailableYears(accountIds),
  ]);

  // Cash balance
  let cashBalance = 0;
  if (isSingle) {
    const balances = await getCashBalances(primaryAccountId);
    cashBalance = balances.reduce((sum, b) => sum + (b.balance ?? 0), 0);
  }

  // Nombre del cliente
  const clientName = accounts[0].clients?.full_name ?? user.email ?? "Mi Cartera";

  const initialData = {
    accountId: isSingle ? primaryAccountId : "all",
    year: year ?? null,
    positions,
    history,
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
      availableYears={availableYears}
      initialData={initialData}
      fetchUrl="/api/dashboard"
    />
  );
}
