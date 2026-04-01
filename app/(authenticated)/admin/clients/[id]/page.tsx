import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getLatestPositions,
  getPositionHistory,
  getAvailableDateRange,
} from "@/lib/queries/positions";
import type { DateRange } from "@/lib/queries/positions";
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
  const dateFromParam = typeof sp.dateFrom === "string" ? sp.dateFrom : undefined;
  const dateToParam = typeof sp.dateTo === "string" ? sp.dateTo : undefined;

  const dateRange: DateRange | undefined =
    dateFromParam || dateToParam ? { dateFrom: dateFromParam, dateTo: dateToParam } : undefined;

  // Fetch datos
  const accountIds = allAccounts.map((a) => a.id);

  const [positions, history, opsResult, availableDateRange] = await Promise.all([
    getLatestPositions(id, dateRange),
    getPositionHistory(id, dateRange),
    getOperations(id, { dateRange, page: 1, pageSize: 25 }),
    getAvailableDateRange(accountIds),
  ]);

  // Cash balance
  const balances = await getCashBalances(id);
  const cashBalance = balances.reduce((sum, b) => sum + (b.balance ?? 0), 0);

  const clientName =
    account.clients?.full_name ??
    `Cuenta ...${account.account_number.slice(-8)}`;

  const initialData = {
    accountId: id,
    dateFrom: dateFromParam ?? null,
    dateTo: dateToParam ?? null,
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
      availableDateRange={availableDateRange}
      initialData={initialData}
      fetchUrl="/api/dashboard"
      showBackLink
      backHref="/admin"
      isAdmin
    />
  );
}
