import { createClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/queries/positions";
import type { Operation } from "@/lib/types/database";
import {
  classifyFlow,
  flowAmountEur,
  isPlus,
  isMinus,
} from "@/lib/operations-taxonomy";
import { cached } from "@/lib/cache";

/**
 * Obtiene TODAS las operaciones de uno o varios accounts (sin paginacion).
 *
 * Necesario para los calculos de patrimonio invertido / rentabilidad
 * acumulada / FIFO eur cost: estos calculos requieren ver el HISTORICO
 * COMPLETO de operations, no un subset paginado. La paginacion (page=25)
 * que usa el TAB de Operaciones del dashboard solo sirve para la UI, NO
 * para los calculos.
 *
 * MVP6 #6: Edgard reporto que el Patrimonio invertido salia mal en
 * cliente individual porque solo se cargaban 25 ops.
 *
 * Pagina internamente de 1000 en 1000 para esquivar el limite Supabase.
 */
export async function getAllOperationsForAccounts(
  accountIds: string[],
  dateRange?: DateRange
): Promise<Operation[]> {
  if (accountIds.length === 0) return [];

  const cacheKey = `all_ops_${accountIds.sort().join("_")}_${dateRange?.dateFrom ?? ""}_${dateRange?.dateTo ?? ""}`;

  return cached(cacheKey, 300, async () => {
    const supabase = await createClient();

    const all: Operation[] = [];
    let from = 0;
    const PAGE = 1000;

    for (;;) {
      let q = supabase
        .from("operations")
        .select("*")
        .in("account_id", accountIds)
        .order("operation_date", { ascending: false })
        .range(from, from + PAGE - 1);

      if (dateRange?.dateFrom) q = q.gte("operation_date", dateRange.dateFrom);
      if (dateRange?.dateTo) q = q.lte("operation_date", dateRange.dateTo);

      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) break;

      // Cast en el boundary: el cliente Supabase esta tipado como <any>
      // (lib/supabase/server.ts), pero el SELECT * sobre la tabla operations
      // devuelve exactamente las columnas del Row, asi que el cast es seguro.
      all.push(...(data as Operation[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }

    return all;
  });
}

/**
 * Obtiene operaciones de una cuenta, con paginacion y filtro por rango de fechas.
 */
export async function getOperations(
  accountId: string,
  options?: { dateRange?: DateRange; page?: number; pageSize?: number }
) {
  const supabase = await createClient();
  const { dateRange, page = 1, pageSize = 50 } = options ?? {};

  let query = supabase
    .from("operations")
    .select("*", { count: "exact" })
    .eq("account_id", accountId)
    .order("operation_date", { ascending: false });

  if (dateRange?.dateFrom) {
    query = query.gte("operation_date", dateRange.dateFrom);
  }
  if (dateRange?.dateTo) {
    query = query.lte("operation_date", dateRange.dateTo);
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

// ===========================================================================
// MVP6 — Flows & Analytics (taxonomia oficial Edgard)
// ===========================================================================

export interface FlowByPeriod {
  period: string;
  inflows: number;
  outflows: number;
  netFlow: number;
}

export async function getFlowsByPeriod(
  accountIds: string[],
  groupBy: "month" | "quarter" = "month"
): Promise<FlowByPeriod[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("operations")
    .select(
      "operation_type, eur_amount, gross_amount, fx_rate, operation_date"
    )
    .in("account_id", accountIds);

  if (error) throw error;

  const map = new Map<string, { inflows: number; outflows: number }>();

  for (const op of data ?? []) {
    if (!op.operation_date) continue;
    const cat = classifyFlow(op.operation_type ?? "");
    if (cat === "neutro") continue;

    const d = new Date(op.operation_date);
    let key: string;
    if (groupBy === "quarter") {
      const q = Math.ceil((d.getMonth() + 1) / 3);
      key = `${d.getFullYear()}-Q${q}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    if (!map.has(key)) map.set(key, { inflows: 0, outflows: 0 });
    const entry = map.get(key)!;

    // flowAmountEur ya devuelve PLUS positivo, MINUS negativo.
    const signed = flowAmountEur(op);
    if (signed > 0) entry.inflows += signed;
    else entry.outflows += Math.abs(signed);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, { inflows, outflows }]) => ({
      period,
      inflows,
      outflows,
      netFlow: inflows - outflows,
    }));
}

export interface NetContributions {
  totalContributions: number;
  totalWithdrawals: number;
  netContributions: number;
}

export async function getNetContributions(
  accountIds: string[]
): Promise<NetContributions> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("operations")
    .select("operation_type, eur_amount, gross_amount, fx_rate")
    .in("account_id", accountIds);

  if (error) throw error;

  let totalContributions = 0;
  let totalWithdrawals = 0;

  for (const op of data ?? []) {
    const signed = flowAmountEur(op);
    if (signed > 0) totalContributions += signed;
    else if (signed < 0) totalWithdrawals += Math.abs(signed);
  }

  return {
    totalContributions,
    totalWithdrawals,
    netContributions: totalContributions - totalWithdrawals,
  };
}

/**
 * Variante de getNetContributions sin filtro por cuentas: agrega TODAS las
 * operations de la BD. Usado en la vista global del admin (Edgard MVP6:
 * el tile "Patrimonio invertido" debe sumar las aportaciones netas de
 * todos los clientes, no solo del seleccionado).
 *
 * Pagina de 1000 en 1000 para evitar el limite de Supabase.
 */
export async function getNetContributionsAll(): Promise<NetContributions> {
  const supabase = await createClient();

  let totalContributions = 0;
  let totalWithdrawals = 0;
  let from = 0;
  const PAGE = 1000;

  // Loop hasta agotar los registros
  // (10.451 ops actuales -> 11 paginas)
  for (;;) {
    const { data, error } = await supabase
      .from("operations")
      .select("operation_type, eur_amount, gross_amount, fx_rate")
      .range(from, from + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const op of data) {
      const signed = flowAmountEur(op);
      if (signed > 0) totalContributions += signed;
      else if (signed < 0) totalWithdrawals += Math.abs(signed);
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return {
    totalContributions,
    totalWithdrawals,
    netContributions: totalContributions - totalWithdrawals,
  };
}

export interface TotalCosts {
  totalCommissions: number;
  totalRetentions: number;
  totalCosts: number;
}

export async function getTotalCosts(
  accountIds: string[]
): Promise<TotalCosts> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("operations")
    .select("commission, withholding")
    .in("account_id", accountIds);

  if (error) throw error;

  let totalCommissions = 0;
  let totalRetentions = 0;

  for (const op of data ?? []) {
    totalCommissions += op.commission ?? 0;
    totalRetentions += op.withholding ?? 0;
  }

  return {
    totalCommissions,
    totalRetentions,
    totalCosts: totalCommissions + totalRetentions,
  };
}

export interface RentabilidadPeriod {
  period: string;
  returnPct: number;
  returnEur: number;
}

export async function getRentabilidad(
  accountIds: string[],
  currentValue: number
): Promise<RentabilidadPeriod[]> {
  const supabase = await createClient();

  // Get all snapshots to calculate period returns
  const { data: snapshots } = await supabase
    .from("positions")
    .select("snapshot_date, position_value")
    .in("account_id", accountIds.length > 0 && accountIds.length <= 50 ? accountIds : [accountIds[0]])
    .order("snapshot_date");

  // Group by date
  const byDate = new Map<string, number>();
  for (const row of snapshots ?? []) {
    byDate.set(
      row.snapshot_date,
      (byDate.get(row.snapshot_date) ?? 0) + (row.position_value ?? 0)
    );
  }

  const dates = Array.from(byDate.keys()).sort();
  if (dates.length === 0) return [];

  const now = new Date();
  const results: RentabilidadPeriod[] = [];

  const periods: { label: string; daysAgo?: number; yearStart?: boolean }[] = [
    { label: "1M", daysAgo: 30 },
    { label: "3M", daysAgo: 90 },
    { label: "YTD", yearStart: true },
    { label: "1A", daysAgo: 365 },
    { label: "ALL" },
  ];

  for (const p of periods) {
    let targetDate: string;

    if (p.label === "ALL") {
      targetDate = dates[0];
    } else if (p.yearStart) {
      targetDate = `${now.getFullYear()}-01-01`;
    } else {
      const d = new Date(now);
      d.setDate(d.getDate() - (p.daysAgo ?? 0));
      targetDate = d.toISOString().split("T")[0];
    }

    // Find closest date >= targetDate
    const closest = dates.find((d) => d >= targetDate) ?? dates[0];
    const startValue = byDate.get(closest) ?? 0;

    if (startValue > 0) {
      const returnEur = currentValue - startValue;
      const returnPct = (returnEur / startValue) * 100;
      results.push({ period: p.label, returnPct, returnEur });
    } else {
      results.push({ period: p.label, returnPct: 0, returnEur: 0 });
    }
  }

  return results;
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
