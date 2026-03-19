import { createClient } from "@/lib/supabase/server";

/**
 * Obtiene los saldos de efectivo de una cuenta.
 */
export async function getCashBalances(accountId: string, snapshotDate?: string) {
  const supabase = await createClient();

  let query = supabase
    .from("cash_balances")
    .select("*")
    .eq("account_id", accountId)
    .order("snapshot_date", { ascending: false });

  if (snapshotDate) {
    query = query.eq("snapshot_date", snapshotDate);
  } else {
    query = query.limit(1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
