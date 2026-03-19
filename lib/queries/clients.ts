import { createClient } from "@/lib/supabase/server";

/**
 * Obtiene todas las cuentas con info del cliente asociado.
 * Solo para admin.
 */
type AccountWithClient = {
  id: string;
  account_number: string;
  label: string | null;
  created_at: string;
  clients: { id: string; full_name: string; email: string | null } | null;
};

export async function getAllAccounts(): Promise<AccountWithClient[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("accounts")
    .select(`
      id,
      account_number,
      label,
      created_at,
      clients (
        id,
        full_name,
        email
      )
    `)
    .order("account_number");

  if (error) throw error;
  return (data ?? []) as unknown as AccountWithClient[];
}

/**
 * Busca cuentas por numero o nombre de cliente.
 */
export async function searchAccounts(query: string) {
  const supabase = await createClient();

  const { data: byAccount } = await supabase
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
    .ilike("account_number", `%${query}%`)
    .limit(20);

  const { data: byClient } = await supabase
    .from("clients")
    .select(`
      id,
      full_name,
      email,
      accounts (
        id,
        account_number,
        label
      )
    `)
    .ilike("full_name", `%${query}%`)
    .limit(20);

  return { byAccount: byAccount ?? [], byClient: byClient ?? [] };
}

/**
 * Obtiene las cuentas de un cliente por su email.
 */
export async function getClientAccounts(email: string): Promise<AccountWithClient[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("accounts")
    .select(`
      id,
      account_number,
      label,
      created_at,
      clients!inner (
        id,
        full_name,
        email
      )
    `)
    .eq("clients.email", email);

  if (error) throw error;
  return (data ?? []) as unknown as AccountWithClient[];
}

/**
 * Obtiene el AUM total.
 */
export async function getTotalAUM() {
  const supabase = await createClient();

  const { data: latestRows } = await supabase
    .from("positions")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (!latestRows || latestRows.length === 0) return { totalAUM: 0, snapshotDate: null, totalAccounts: 0, totalPositions: 0 };

  const latestDate = latestRows[0].snapshot_date;

  const { data: positions } = await supabase
    .from("positions")
    .select("position_value, account_id")
    .eq("snapshot_date", latestDate);

  const totalAUM = positions?.reduce((sum, p) => sum + (p.position_value ?? 0), 0) ?? 0;
  const uniqueAccounts = new Set(positions?.map((p) => p.account_id) ?? []);

  return {
    totalAUM,
    snapshotDate: latestDate,
    totalAccounts: uniqueAccounts.size,
    totalPositions: positions?.length ?? 0,
  };
}
