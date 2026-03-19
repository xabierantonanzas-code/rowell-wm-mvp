import { createClient } from "@/lib/supabase/server";
import type { Position } from "@/lib/types/database";

/**
 * Obtiene las posiciones mas recientes para una cuenta,
 * opcionalmente filtradas por ano.
 */
export async function getLatestPositions(
  accountId: string,
  year?: number
): Promise<Position[]> {
  const supabase = await createClient();

  // Construir query para obtener la fecha mas reciente
  let dateQuery = supabase
    .from("positions")
    .select("snapshot_date")
    .eq("account_id", accountId)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  // Si hay filtro de ano, buscar la ultima fecha dentro de ese ano
  if (year) {
    dateQuery = dateQuery
      .gte("snapshot_date", `${year}-01-01`)
      .lte("snapshot_date", `${year}-12-31`);
  }

  const { data: latestRow } = await dateQuery;

  if (!latestRow || latestRow.length === 0) return [];

  const latestDate = latestRow[0].snapshot_date;

  // Obtener todas las posiciones de esa fecha
  const { data, error } = await supabase
    .from("positions")
    .select("*")
    .eq("account_id", accountId)
    .eq("snapshot_date", latestDate)
    .order("position_value", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Position[];
}

/**
 * Obtiene el historial de snapshots para un grafico de evolucion.
 * Devuelve el valor total por fecha de snapshot.
 * Opcionalmente filtrado por ano.
 */
export async function getPositionHistory(accountId: string, year?: number) {
  const supabase = await createClient();

  let query = supabase
    .from("positions")
    .select("snapshot_date, position_value")
    .eq("account_id", accountId)
    .order("snapshot_date");

  if (year) {
    query = query
      .gte("snapshot_date", `${year}-01-01`)
      .lte("snapshot_date", `${year}-12-31`);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Agrupar por snapshot_date y sumar position_value
  const grouped = new Map<string, number>();
  for (const row of data ?? []) {
    const current = grouped.get(row.snapshot_date) ?? 0;
    grouped.set(row.snapshot_date, current + (row.position_value ?? 0));
  }

  return Array.from(grouped.entries()).map(([date, total]) => ({
    date,
    totalValue: total,
  }));
}

/**
 * Obtiene posiciones agregadas para multiples cuentas.
 */
export async function getAggregatedPositions(
  accountIds: string[],
  year?: number
): Promise<Position[]> {
  const supabase = await createClient();

  // Obtener la fecha mas reciente
  let dateQuery = supabase
    .from("positions")
    .select("snapshot_date")
    .in("account_id", accountIds)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (year) {
    dateQuery = dateQuery
      .gte("snapshot_date", `${year}-01-01`)
      .lte("snapshot_date", `${year}-12-31`);
  }

  const { data: latestRow } = await dateQuery;

  if (!latestRow || latestRow.length === 0) return [];

  const latestDate = latestRow[0].snapshot_date;

  const { data, error } = await supabase
    .from("positions")
    .select("*")
    .in("account_id", accountIds)
    .eq("snapshot_date", latestDate)
    .order("position_value", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Position[];
}

/**
 * Historial de posiciones para multiples cuentas (grafico consolidado).
 */
export async function getAggregatedHistory(accountIds: string[], year?: number) {
  const supabase = await createClient();

  let query = supabase
    .from("positions")
    .select("snapshot_date, position_value")
    .in("account_id", accountIds)
    .order("snapshot_date");

  if (year) {
    query = query
      .gte("snapshot_date", `${year}-01-01`)
      .lte("snapshot_date", `${year}-12-31`);
  }

  const { data, error } = await query;

  if (error) throw error;

  const grouped = new Map<string, number>();
  for (const row of data ?? []) {
    const current = grouped.get(row.snapshot_date) ?? 0;
    grouped.set(row.snapshot_date, current + (row.position_value ?? 0));
  }

  return Array.from(grouped.entries()).map(([date, total]) => ({
    date,
    totalValue: total,
  }));
}

/**
 * Obtiene todas las snapshot_dates disponibles para una cuenta (o varias).
 * Util para determinar los anos con datos.
 */
export async function getAvailableYears(accountIds: string[]): Promise<number[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("positions")
    .select("snapshot_date")
    .in("account_id", accountIds);

  if (error) throw error;

  const years = new Set<number>();
  for (const row of data ?? []) {
    const year = new Date(row.snapshot_date).getFullYear();
    years.add(year);
  }

  return Array.from(years).sort((a, b) => b - a); // Mas reciente primero
}
