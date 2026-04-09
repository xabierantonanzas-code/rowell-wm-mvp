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
import {
  getOperations,
  getAllOperationsForAccounts,
} from "@/lib/queries/operations";
import { getGlobalAdminKpis } from "@/lib/queries/admin-summary";
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

    // MVP6 #6: SIEMPRE traer TODAS las operations del cliente para los
    // calculos (patrimonio invertido, rentabilidad, FIFO). Antes se traian
    // solo 25 paginadas y eso rompia los KPIs en clientes con muchos
    // movimientos como Aurum-077 (174 ops).
    const [positions, history, allOps, availDateRange] = await Promise.all([
      isSingle
        ? (await import("@/lib/queries/positions")).getLatestPositions(primaryAccountId, dateRange)
        : getAggregatedPositions(clientAccountIds, dateRange),
      isSingle
        ? (await import("@/lib/queries/positions")).getPositionHistory(primaryAccountId, dateRange)
        : getAggregatedHistory(clientAccountIds, dateRange),
      getAllOperationsForAccounts(clientAccountIds, dateRange),
      getAvailableDateRange(clientAccountIds),
    ]);

    // Para el TAB visual de Operaciones, paginar in-memory (page 1, 25/pag)
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
      // MVP6 #6: pasamos TODAS las ops (allOps) en operations.operations
      // para que los useMemo de netContributions/FIFO/productTypeMap calculen
      // sobre el historico completo. El TAB visual paginara client-side.
      operations: {
        operations: allOps,
        total: allOps.length,
        page: 1,
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
  // MVP6 P2: los KPIs globales (AUM, invertido, rentabilidad) vienen de
  // la vista materializada global_kpis via getGlobalAdminKpis(). Con la
  // migracion 007 aplicada, esto es O(1). Sin migracion, cae al fallback
  // SQL que sigue siendo mas rapido que iterar 10k ops en JS.
  const [positions, history, availDateRange, globalKpis] = await Promise.all([
    getAllLatestPositions(dateRange),
    getAllPositionHistory(dateRange),
    getAvailableDateRange([]),
    getGlobalAdminKpis(),
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
      initialNetContributionsGlobal={globalKpis.patrimonioInvertido}
      activeClientName="Todos los Clientes"
      totalAccounts={accounts.length}
      invitations={invitations}
    />
  );
}
