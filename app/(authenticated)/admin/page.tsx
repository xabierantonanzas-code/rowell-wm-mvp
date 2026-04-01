import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTotalAUM, getAllAccounts } from "@/lib/queries/clients";
import {
  getAggregatedPositions,
  getAggregatedHistory,
  getAvailableDateRange,
  getHistoryByAccount,
  getAllLatestPositions,
  getAllPositionHistory,
} from "@/lib/queries/positions";
import type { DateRange } from "@/lib/queries/positions";
import { getOperations } from "@/lib/queries/operations";
import { getCashBalances } from "@/lib/queries/balances";
import AdminDashboard from "@/components/admin/AdminDashboard";
import ClientDashboard from "@/components/dashboard/ClientDashboard";

// ===========================================================================
// Pagina Admin
// ===========================================================================

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || (user.app_metadata?.role !== "admin" && user.app_metadata?.role !== "owner")) {
    redirect("/dashboard");
  }

  // Obtener todas las cuentas con clientes
  const [aumData, accounts] = await Promise.all([
    getTotalAUM(),
    getAllAccounts(),
  ]);

  // Agrupar cuentas por cliente
  const clientsMap = new Map<string, {
    id: string;
    name: string;
    email: string | null;
    accounts: { id: string; account_number: string; label: string | null }[];
  }>();

  const unassigned: { id: string; account_number: string; label: string | null }[] = [];

  for (const acc of accounts) {
    const client = acc.clients;
    if (client) {
      if (!clientsMap.has(client.id)) {
        clientsMap.set(client.id, {
          id: client.id,
          name: client.full_name,
          email: client.email,
          accounts: [],
        });
      }
      clientsMap.get(client.id)!.accounts.push({
        id: acc.id,
        account_number: acc.account_number,
        label: acc.label,
      });
    } else {
      unassigned.push({
        id: acc.id,
        account_number: acc.account_number,
        label: acc.label,
      });
    }
  }

  const clients = Array.from(clientsMap.values());

  // Fetch invitation status for all clients (graceful if tables don't exist yet)
  let invitationRows: { client_id: string; status: string }[] = [];
  try {
    const { data } = await supabase
      .from("invitations")
      .select("client_id, status")
      .order("invited_at", { ascending: false });
    invitationRows = data ?? [];
  } catch { /* table may not exist yet */ }

  // Also check which clients have auth_user_id set
  let confirmedClientIds = new Set<string>();
  try {
    const { data: clientsWithAuth } = await supabase
      .from("clients")
      .select("id, auth_user_id")
      .not("auth_user_id", "is", null);
    confirmedClientIds = new Set(
      (clientsWithAuth ?? []).map((c) => c.id)
    );
  } catch { /* column may not exist yet */ }

  const invitations = clients.map((c) => {
    if (confirmedClientIds.has(c.id)) {
      return { clientId: c.id, status: "confirmed" as const };
    }
    const inv = (invitationRows ?? []).find((i) => i.client_id === c.id && i.status === "pending");
    if (inv) {
      return { clientId: c.id, status: "pending" as const };
    }
    return { clientId: c.id, status: "none" as const };
  });

  // Parsear filtros de URL
  const selectedClientId = typeof sp.client === "string" ? sp.client : undefined;
  const dateFromParam = typeof sp.dateFrom === "string" ? sp.dateFrom : undefined;
  const dateToParam = typeof sp.dateTo === "string" ? sp.dateTo : undefined;

  const dateRange: DateRange | undefined =
    dateFromParam || dateToParam ? { dateFrom: dateFromParam, dateTo: dateToParam } : undefined;

  const isAllClients = !selectedClientId || !clientsMap.has(selectedClientId);

  // =========================================================================
  // CLIENT SELECTED → render ClientDashboard (same view as client)
  // =========================================================================
  if (!isAllClients) {
    const cl = clientsMap.get(selectedClientId!)!;
    const clientAccountIds = cl.accounts.map((a) => a.id);
    const isSingle = clientAccountIds.length === 1;
    const primaryAccountId = clientAccountIds[0];

    const [positions, history, opsResult, availDateRange] = await Promise.all([
      isSingle
        ? (await import("@/lib/queries/positions")).getLatestPositions(primaryAccountId, dateRange)
        : getAggregatedPositions(clientAccountIds, dateRange),
      isSingle
        ? (await import("@/lib/queries/positions")).getPositionHistory(primaryAccountId, dateRange)
        : getAggregatedHistory(clientAccountIds, dateRange),
      isSingle
        ? getOperations(primaryAccountId, { dateRange, page: 1, pageSize: 25 })
        : Promise.resolve({ operations: [] as any[], total: 0, page: 1, totalPages: 0, pageSize: 25 }),
      getAvailableDateRange(clientAccountIds),
    ]);

    // Cash balance
    let cashBalance = 0;
    if (isSingle) {
      const balances = await getCashBalances(primaryAccountId);
      cashBalance = balances.reduce((sum, b) => sum + (b.balance ?? 0), 0);
    }

    // Per-account history for strategy chart
    let historyByAccount: Record<string, { date: string; totalValue: number }[]> | undefined;
    if (!isSingle) {
      const histMap = await getHistoryByAccount(clientAccountIds, dateRange);
      historyByAccount = Object.fromEntries(histMap);
    }

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

    const accountOptions = cl.accounts.map((a) => ({
      id: a.id,
      account_number: a.account_number,
      label: a.label,
    }));

    return (
      <div className="space-y-4">
        {/* Admin client selector bar */}
        <AdminDashboard
          clients={clients}
          unassignedAccounts={unassigned}
          selectedClientId={selectedClientId!}
          aumData={aumData}
          availableDateRange={availDateRange}
          initialDateFrom={dateFromParam ?? null}
          initialDateTo={dateToParam ?? null}
          initialPositions={[]}
          initialHistory={[]}
          initialOperations={{ operations: [], total: 0, page: 1, totalPages: 0 }}
          activeClientName={cl.name}
          totalAccounts={accounts.length}
          invitations={invitations}
          selectorOnly
        />

        {/* Full client dashboard — same view as client sees */}
        <ClientDashboard
          clientName={cl.name}
          clientId={cl.id}
          accounts={accountOptions}
          availableDateRange={availDateRange}
          initialData={initialData}
          fetchUrl="/api/dashboard"
          showBackLink={false}
          isAdmin
        />
      </div>
    );
  }

  // =========================================================================
  // ALL CLIENTS → aggregated admin view
  // =========================================================================
  const [positions, history, availDateRange] = await Promise.all([
    getAllLatestPositions(dateRange),
    getAllPositionHistory(dateRange),
    getAvailableDateRange([]),
  ]);

  return (
    <AdminDashboard
      clients={clients}
      unassignedAccounts={unassigned}
      selectedClientId={null}
      aumData={aumData}
      availableDateRange={availDateRange}
      initialDateFrom={dateFromParam ?? null}
      initialDateTo={dateToParam ?? null}
      initialPositions={positions}
      initialHistory={history}
      initialOperations={{ operations: [], total: 0, page: 1, totalPages: 0 }}
      activeClientName="Todos los Clientes"
      totalAccounts={accounts.length}
      invitations={invitations}
    />
  );
}
