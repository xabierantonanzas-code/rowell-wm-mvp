import { createClient } from "@/lib/supabase/server";

/**
 * Obtiene operaciones de una cuenta, con paginacion y filtro por año.
 */
export async function getOperations(
  accountId: string,
  options?: { year?: number; page?: number; pageSize?: number }
) {
  const supabase = await createClient();
  const { year, page = 1, pageSize = 50 } = options ?? {};

  let query = supabase
    .from("operations")
    .select("*", { count: "exact" })
    .eq("account_id", accountId)
    .order("operation_date", { ascending: false });

  if (year) {
    query = query
      .gte("operation_date", `${year}-01-01`)
      .lte("operation_date", `${year}-12-31`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    operations: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

/**
 * Estadisticas de operaciones por tipo.
 */
export async function getOperationStats(accountId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("operations")
    .select("operation_type, eur_amount")
    .eq("account_id", accountId);

  if (error) throw error;

  const stats: Record<string, { count: number; totalAmount: number }> = {};

  for (const op of data ?? []) {
    const type = op.operation_type;
    if (!stats[type]) {
      stats[type] = { count: 0, totalAmount: 0 };
    }
    stats[type].count++;
    stats[type].totalAmount += op.eur_amount ?? 0;
  }

  return stats;
}
