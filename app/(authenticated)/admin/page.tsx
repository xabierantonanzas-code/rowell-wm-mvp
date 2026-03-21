import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTotalAUM, getAllAccounts } from "@/lib/queries/clients";
import {
  getAggregatedPositions,
  getAggregatedHistory,
  getAvailableYears,
  getAllLatestPositions,
  getAllPositionHistory,
} from "@/lib/queries/positions";
import { getOperations } from "@/lib/queries/operations";
import AdminDashboard from "@/components/admin/AdminDashboard";

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

  if (!user || user.app_metadata?.role !== "admin") {
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

  // Parsear filtro de cliente de URL
  const selectedClientId = typeof sp.client === "string" ? sp.client : undefined;
  const yearParam = typeof sp.year === "string" ? parseInt(sp.year, 10) : undefined;
  const year = yearParam && !isNaN(yearParam) ? yearParam : undefined;

  // Determinar cuentas segun filtro
  let activeAccountIds: string[] = [];
  let activeClientName: string;
  const isAllClients = !selectedClientId || !clientsMap.has(selectedClientId);

  if (!isAllClients) {
    const cl = clientsMap.get(selectedClientId!)!;
    activeAccountIds = cl.accounts.map((a) => a.id);
    activeClientName = cl.name;
  } else {
    activeClientName = "Todos los Clientes";
  }

  // Fetch datos del dashboard
  // For "all clients" use unfiltered queries to avoid URL overflow with 200+ account IDs
  const [positions, history, availableYears] = await Promise.all([
    isAllClients
      ? getAllLatestPositions(year)
      : getAggregatedPositions(activeAccountIds, year),
    isAllClients
      ? getAllPositionHistory(year)
      : getAggregatedHistory(activeAccountIds, year),
    isAllClients
      ? getAvailableYears([])
      : getAvailableYears(activeAccountIds),
  ]);

  // Operaciones: solo si es un solo cliente con una cuenta
  let opsResult = { operations: [] as any[], total: 0, page: 1, totalPages: 0, pageSize: 25 };
  if (selectedClientId && activeAccountIds.length === 1) {
    opsResult = await getOperations(activeAccountIds[0], { year, page: 1, pageSize: 25 });
  }

  return (
    <AdminDashboard
      clients={clients}
      unassignedAccounts={unassigned}
      selectedClientId={selectedClientId ?? null}
      aumData={aumData}
      availableYears={availableYears}
      initialYear={year ?? null}
      initialPositions={positions}
      initialHistory={history}
      initialOperations={{
        operations: opsResult.operations,
        total: opsResult.total,
        page: opsResult.page,
        totalPages: opsResult.totalPages,
      }}
      activeClientName={activeClientName}
      totalAccounts={accounts.length}
    />
  );
}
