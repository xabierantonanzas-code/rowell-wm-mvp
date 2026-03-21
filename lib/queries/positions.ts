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

// ===========================================================================
// MVP4 — KPIs de Edgard
// ===========================================================================

export interface PortfolioSummary {
  totalValue: number;
  investedValue: number;
  cashBalance: number;
  cashPct: number;
  latentPnL: number;
  latentPnLPct: number;
  fundCount: number;
  isinCount: number;
  lastSnapshotDate: string;
  lastCotizationDate: string;
}

export async function getPortfolioSummary(
  accountIds: string[]
): Promise<PortfolioSummary> {
  const supabase = await createClient();

  // Latest snapshot date
  const { data: dateRow } = await supabase
    .from("positions")
    .select("snapshot_date")
    .in("account_id", accountIds)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (!dateRow || dateRow.length === 0) {
    return {
      totalValue: 0, investedValue: 0, cashBalance: 0, cashPct: 0,
      latentPnL: 0, latentPnLPct: 0, fundCount: 0, isinCount: 0,
      lastSnapshotDate: "", lastCotizationDate: "",
    };
  }

  const latestDate = dateRow[0].snapshot_date;

  const { data: positions } = await supabase
    .from("positions")
    .select("isin, product_name, units, avg_cost, market_price, position_value")
    .in("account_id", accountIds)
    .eq("snapshot_date", latestDate);

  const { data: balances } = await supabase
    .from("cash_balances")
    .select("balance")
    .in("account_id", accountIds)
    .eq("snapshot_date", latestDate);

  const pos = positions ?? [];
  const bal = balances ?? [];

  const totalInvested = pos.reduce((s, p) => s + (p.position_value ?? 0), 0);
  const totalCost = pos.reduce(
    (s, p) => s + (p.units ?? 0) * (p.avg_cost ?? 0), 0
  );
  const cashBalance = bal.reduce((s, b) => s + (b.balance ?? 0), 0);
  const totalValue = totalInvested + cashBalance;
  const latentPnL = totalInvested - totalCost;
  const isins = new Set(pos.map((p) => p.isin).filter(Boolean));

  return {
    totalValue,
    investedValue: totalInvested,
    cashBalance,
    cashPct: totalValue > 0 ? (cashBalance / totalValue) * 100 : 0,
    latentPnL,
    latentPnLPct: totalCost > 0 ? (latentPnL / totalCost) * 100 : 0,
    fundCount: pos.length,
    isinCount: isins.size,
    lastSnapshotDate: latestDate,
    lastCotizationDate: latestDate,
  };
}

export interface TopHolding {
  isin: string;
  productName: string;
  manager: string;
  value: number;
  weight: number;
  pnl: number;
  pnlPct: number;
}

export async function getTopHoldings(
  accountIds: string[],
  limit = 10
): Promise<TopHolding[]> {
  const supabase = await createClient();

  const { data: dateRow } = await supabase
    .from("positions")
    .select("snapshot_date")
    .in("account_id", accountIds)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (!dateRow || dateRow.length === 0) return [];
  const latestDate = dateRow[0].snapshot_date;

  const { data: positions } = await supabase
    .from("positions")
    .select("isin, product_name, manager, units, avg_cost, position_value")
    .in("account_id", accountIds)
    .eq("snapshot_date", latestDate)
    .order("position_value", { ascending: false })
    .limit(limit);

  const pos = positions ?? [];
  const totalValue = pos.reduce((s, p) => s + (p.position_value ?? 0), 0);

  return pos.map((p) => {
    const cost = (p.units ?? 0) * (p.avg_cost ?? 0);
    const pnl = (p.position_value ?? 0) - cost;
    return {
      isin: p.isin ?? "",
      productName: p.product_name ?? "",
      manager: p.manager ?? "",
      value: p.position_value ?? 0,
      weight: totalValue > 0 ? ((p.position_value ?? 0) / totalValue) * 100 : 0,
      pnl,
      pnlPct: cost > 0 ? (pnl / cost) * 100 : 0,
    };
  });
}

export async function getDistributionByManager(
  accountIds: string[]
): Promise<{ name: string; value: number; pct: number }[]> {
  const supabase = await createClient();

  const { data: dateRow } = await supabase
    .from("positions")
    .select("snapshot_date")
    .in("account_id", accountIds)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (!dateRow || dateRow.length === 0) return [];
  const latestDate = dateRow[0].snapshot_date;

  const { data: positions } = await supabase
    .from("positions")
    .select("manager, position_value")
    .in("account_id", accountIds)
    .eq("snapshot_date", latestDate);

  const byManager = new Map<string, number>();
  let total = 0;
  for (const p of positions ?? []) {
    const mgr = p.manager || "Otros";
    byManager.set(mgr, (byManager.get(mgr) ?? 0) + (p.position_value ?? 0));
    total += p.position_value ?? 0;
  }

  return Array.from(byManager.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
    }));
}

export async function getDistributionByCurrency(
  accountIds: string[]
): Promise<{ currency: string; value: number; pct: number }[]> {
  const supabase = await createClient();

  const { data: dateRow } = await supabase
    .from("positions")
    .select("snapshot_date")
    .in("account_id", accountIds)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (!dateRow || dateRow.length === 0) return [];
  const latestDate = dateRow[0].snapshot_date;

  const { data: positions } = await supabase
    .from("positions")
    .select("currency, position_value")
    .in("account_id", accountIds)
    .eq("snapshot_date", latestDate);

  const byCurrency = new Map<string, number>();
  let total = 0;
  for (const p of positions ?? []) {
    const cur = p.currency || "EUR";
    byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + (p.position_value ?? 0));
    total += p.position_value ?? 0;
  }

  return Array.from(byCurrency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([currency, value]) => ({
      currency,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
    }));
}

export async function getPatrimonyHistory(
  accountIds: string[]
): Promise<{ date: string; totalValue: number; cashBalance: number }[]> {
  const supabase = await createClient();

  // Position history
  const { data: posData } = await supabase
    .from("positions")
    .select("snapshot_date, position_value")
    .in("account_id", accountIds)
    .order("snapshot_date");

  const posByDate = new Map<string, number>();
  for (const row of posData ?? []) {
    posByDate.set(
      row.snapshot_date,
      (posByDate.get(row.snapshot_date) ?? 0) + (row.position_value ?? 0)
    );
  }

  // Cash history
  const { data: cashData } = await supabase
    .from("cash_balances")
    .select("snapshot_date, balance")
    .in("account_id", accountIds)
    .order("snapshot_date");

  const cashByDate = new Map<string, number>();
  for (const row of cashData ?? []) {
    cashByDate.set(
      row.snapshot_date,
      (cashByDate.get(row.snapshot_date) ?? 0) + (row.balance ?? 0)
    );
  }

  const allDates = new Set([...Array.from(posByDate.keys()), ...Array.from(cashByDate.keys())]);
  return Array.from(allDates)
    .sort()
    .map((date) => ({
      date,
      totalValue: (posByDate.get(date) ?? 0) + (cashByDate.get(date) ?? 0),
      cashBalance: cashByDate.get(date) ?? 0,
    }));
}

/**
 * Obtiene todas las snapshot_dates disponibles para una cuenta (o varias).
 * Util para determinar los anos con datos.
 * Si accountIds tiene más de 50 elementos, consulta sin filtro.
 */
export async function getAvailableYears(accountIds: string[]): Promise<number[]> {
  const supabase = await createClient();

  let query = supabase.from("positions").select("snapshot_date");

  if (accountIds.length > 0 && accountIds.length <= 50) {
    query = query.in("account_id", accountIds);
  }

  const { data, error } = await query;

  if (error) throw error;

  const years = new Set<number>();
  for (const row of data ?? []) {
    const year = new Date(row.snapshot_date).getFullYear();
    years.add(year);
  }

  return Array.from(years).sort((a, b) => b - a);
}

// ===========================================================================
// All-accounts queries (admin view, no account filter)
// ===========================================================================

export async function getAllLatestPositions(year?: number): Promise<Position[]> {
  const supabase = await createClient();

  let dateQuery = supabase
    .from("positions")
    .select("snapshot_date")
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

  // Paginate to get all positions (Supabase default limit is 1000)
  const allPositions: Position[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("positions")
      .select("*")
      .eq("snapshot_date", latestDate)
      .order("position_value", { ascending: false })
      .range(from, from + 999);

    if (error) throw error;
    if (!data || data.length === 0) break;
    allPositions.push(...(data as Position[]));
    if (data.length < 1000) break;
    from += 1000;
  }

  return allPositions;
}

export async function getAllPositionHistory(year?: number) {
  const supabase = await createClient();

  const grouped = new Map<string, number>();
  let from = 0;

  while (true) {
    let query = supabase
      .from("positions")
      .select("snapshot_date, position_value")
      .order("snapshot_date")
      .range(from, from + 4999);

    if (year) {
      query = query
        .gte("snapshot_date", `${year}-01-01`)
        .lte("snapshot_date", `${year}-12-31`);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      grouped.set(
        row.snapshot_date,
        (grouped.get(row.snapshot_date) ?? 0) + (row.position_value ?? 0)
      );
    }

    if (data.length < 5000) break;
    from += 5000;
  }

  return Array.from(grouped.entries()).map(([date, total]) => ({
    date,
    totalValue: total,
  }));
}
