import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllAccounts } from "@/lib/queries/clients";
import {
  getLatestPositions,
  getPositionHistory,
  getAvailableDateRange,
} from "@/lib/queries/positions";
import { getAllOperationsForAccounts } from "@/lib/queries/operations";
import { getCashBalances } from "@/lib/queries/balances";
import CarteraV2Picker from "@/components/dashboard/CarteraV2Picker";
import CarteraV2View from "@/components/dashboard/CarteraV2View";

// ===========================================================================
// Cartera V2 — índice (ruta /cartera-v2).
//
// Selector de cliente con el MISMO patrón que /admin: la tarjeta
// "Selecciona un cliente ▾" con buscador (CarteraV2Picker), navegando por
// ?client=<id>. Cuando hay cliente seleccionado, renderiza CarteraV2View
// debajo del selector. Solo admin / owner.
// ===========================================================================

export default async function CarteraV2IndexPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user ||
    (user.app_metadata?.role !== "admin" && user.app_metadata?.role !== "owner")
  ) {
    redirect("/dashboard");
  }

  // -------------------------------------------------------------------------
  // Lista de clientes (clientsMap como en /admin) a partir de getAllAccounts.
  // -------------------------------------------------------------------------
  const accounts = await getAllAccounts();

  const clientsMap = new Map<string, {
    id: string;
    name: string;
    accounts: { id: string; account_number: string; label: string | null }[];
  }>();

  for (const acc of accounts) {
    const client = acc.clients;
    if (!client) continue;
    if (!clientsMap.has(client.id)) {
      clientsMap.set(client.id, {
        id: client.id,
        name: client.full_name,
        accounts: [],
      });
    }
    clientsMap.get(client.id)!.accounts.push({
      id: acc.id,
      account_number: acc.account_number,
      label: acc.label,
    });
  }

  const clients = Array.from(clientsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "es")
  );

  const selectedClientId = typeof sp.client === "string" ? sp.client : undefined;
  const selectedClient =
    selectedClientId && clientsMap.has(selectedClientId)
      ? clientsMap.get(selectedClientId)!
      : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-rowell-navy sm:text-3xl">
          Evolución de cartera
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Selecciona un cliente para ver la evolución de su cartera.
        </p>
      </div>

      {/* Selector (mismo patrón que /admin: tarjeta con buscador + ?client=) */}
      <CarteraV2Picker
        clients={clients}
        selectedClientId={selectedClient?.id}
      />

      {selectedClient ? (
        <CarteraV2ClientSection client={selectedClient} />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-gray-400">
            Elige un cliente para ver su evolución de cartera.
          </p>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Carga de datos + render de CarteraV2View para el cliente seleccionado.
// Mismo loader que /cartera-v2/[id]: primera cuenta del cliente.
// ===========================================================================
async function CarteraV2ClientSection({
  client,
}: {
  client: {
    id: string;
    name: string;
    accounts: { id: string; account_number: string; label: string | null }[];
  };
}) {
  const primaryAccount = client.accounts[0];

  if (!primaryAccount) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-gray-400">
          Este cliente no tiene carteras asignadas.
        </p>
      </div>
    );
  }

  const acctId = primaryAccount.id;
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
      clientName={client.name}
      accountNumber={primaryAccount.account_number}
      positions={positions}
      history={history}
      operations={operations}
      cashBalance={cashBalance}
      availableDateRange={availableDateRange}
    />
  );
}
