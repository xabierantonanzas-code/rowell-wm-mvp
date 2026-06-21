import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getLatestPositions,
  getPositionHistory,
  getAvailableDateRange,
} from "@/lib/queries/positions";
import { getAllOperationsForAccounts } from "@/lib/queries/operations";
import { getCashBalances } from "@/lib/queries/balances";
import CarteraV2View from "@/components/dashboard/CarteraV2View";

// ===========================================================================
// Cartera V2 — vista de cartera fiel al prototipo de Edgard (wm_cartera).
//
// Ruta NUEVA, no toca el dashboard existente. [id] = account_id (igual que
// app/(authenticated)/admin/clients/[id]/page.tsx). Protegida igual que la
// vista admin: solo roles admin / owner.
// ===========================================================================

export default async function CarteraV2Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  // --- Auth + rol (mismo patron que /admin) ---
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user ||
    (user.app_metadata?.role !== "admin" && user.app_metadata?.role !== "owner")
  ) {
    redirect("/dashboard");
  }

  // --- Resolver [id]: acepta client_id (como /admin?client=) o account_id ---
  let acctId: string | null = null;
  let clientName = "";
  let accountNumber = "";

  // 1) intentar como client_id (es como navega el admin: /admin?client=<id>)
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("id", id)
    .maybeSingle();

  if (clientRow) {
    const { data: accs } = await supabase
      .from("accounts")
      .select("id, account_number")
      .eq("client_id", id)
      .order("account_number");
    if (accs && accs.length > 0) {
      acctId = accs[0].id as string;
      accountNumber = accs[0].account_number as string;
      clientName = (clientRow as { full_name: string | null }).full_name ?? "Cartera";
    }
  }

  // 2) fallback: tratar [id] como account_id
  if (!acctId) {
    const { data: accountData } = await supabase
      .from("accounts")
      .select(`id, account_number, clients ( id, full_name )`)
      .eq("id", id)
      .single();
    if (!accountData) notFound();
    const account = accountData as unknown as {
      id: string;
      account_number: string;
      clients: { id: string; full_name: string } | null;
    };
    acctId = account.id;
    accountNumber = account.account_number;
    clientName = account.clients?.full_name ?? `Cuenta ...${account.account_number.slice(-8)}`;
  }

  // --- Carga de datos (operaciones COMPLETAS para los cálculos SI) ---
  const accountIds = [acctId];

  const [positions, history, operations, availableDateRange, balances] =
    await Promise.all([
      getLatestPositions(acctId),
      getPositionHistory(acctId),
      getAllOperationsForAccounts(accountIds),
      getAvailableDateRange(accountIds),
      getCashBalances(acctId),
    ]);

  const cashBalance = balances.reduce((sum, b) => sum + (b.balance ?? 0), 0);

  return (
    <CarteraV2View
      clientName={clientName}
      accountNumber={accountNumber}
      positions={positions}
      history={history}
      operations={operations}
      cashBalance={cashBalance}
      availableDateRange={availableDateRange}
    />
  );
}
