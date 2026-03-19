import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getLatestPositions,
  getPositionHistory,
  getAvailableYears,
} from "@/lib/queries/positions";
import { getOperations } from "@/lib/queries/operations";
import { getCashBalances } from "@/lib/queries/balances";
import ClientDashboard from "@/components/dashboard/ClientDashboard";

// ===========================================================================
// Pagina de detalle de cuenta (vista admin)
// ===========================================================================

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();

  // Obtener cuenta con cliente
  const { data: accountData } = await supabase
    .from("accounts")
    .select(`
      id,
      account_number,
      label,
      clients (
        id,
        full_name,
        email
      )
    `)
    .eq("id", id)
    .single();

  if (!accountData) {
    notFound();
  }

  const account = accountData as unknown as {
    id: string;
    account_number: string;
    label: string | null;
    clients: { id: string; full_name: string; email: string | null } | null;
  };

  // Obtener todas las cuentas de este cliente (para el selector)
  let allAccounts: typeof account[] = [account];

  if (account.clients?.id) {
    const { data: clientAccounts } = await supabase
      .from("accounts")
      .select(`
        id,
        account_number,
        label,
        clients (
          id,
          full_name,
          email
        )
      `)
      .eq("client_id", account.clients.id)
      .order("account_number");

    if (clientAccounts && clientAccounts.length > 0) {
      allAccounts = clientAccounts as unknown as typeof account[];
    }
  }

  // Parsear filtros
  const yearParam = typeof sp.year === "string" ? parseInt(sp.year, 10) : undefined;
  const year = yearParam && !isNaN(yearParam) ? yearParam : undefined;

  // Fetch datos
  const accountIds = allAccounts.map((a) => a.id);

  const [positions, history, opsResult, availableYears] = await Promise.all([
    getLatestPositions(id, year),
    getPositionHistory(id, year),
    getOperations(id, { year, page: 1, pageSize: 25 }),
    getAvailableYears(accountIds),
  ]);

  // Cash balance
  const balances = await getCashBalances(id);
  const cashBalance = balances.reduce((sum, b) => sum + (b.balance ?? 0), 0);

  const clientName =
    account.clients?.full_name ??
    `Cuenta ...${account.account_number.slice(-8)}`;

  const initialData = {
    accountId: id,
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

  const accountOptions = allAccounts.map((a) => ({
    id: a.id,
    account_number: a.account_number,
    label: a.label,
  }));

  return (
    <ClientDashboard
      clientName={clientName}
      clientId={account.clients?.id ?? undefined}
      accounts={accountOptions}
      availableYears={availableYears}
      initialData={initialData}
      fetchUrl="/api/dashboard"
      showBackLink
      backHref="/admin"
      isAdmin
    />
  );
}
