import { createClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/queries/positions";

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
// MVP4 — Flows & Analytics
// ===========================================================================

const COMPRA_TYPES = new Set([
  "SUSCRIPCIÓN FONDOS INVERSIÓN",
  "SUSC.TRASPASO EXT.",
  "SUSC.TRASPASO. INT.",
  "SUSCRIPCION POR FUSION",
  "COMPRA RV CONTADO",
  "COMPRA SICAVS",
  "ALTA IIC SWITCH",
]);

const VENTA_TYPES = new Set([
  "REEMBOLSO FONDO INVERSIÓN",
  "REEMBOLSO POR TRASPASO EXT.",
  "REEMBOLSO POR TRASPASO INT.",
  "REEMBOLSO OBLIGATORIO IIC",
  "REEMBOLSO POR FUSION",
  "VENTA RV CONTADO",
]);

function isCompra(type: string): boolean {
  return COMPRA_TYPES.has(type.toUpperCase().trim());
}

function isVenta(type: string): boolean {
  return VENTA_TYPES.has(type.toUpperCase().trim());
}

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
    .select("operation_type, eur_amount, operation_date")
    .in("account_id", accountIds);

  if (error) throw error;

  const map = new Map<string, { inflows: number; outflows: number }>();

  for (const op of data ?? []) {
    if (!op.operation_date) continue;
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
    const amount = Math.abs(op.eur_amount ?? 0);
    const type = op.operation_type ?? "";

    if (isCompra(type)) entry.inflows += amount;
    else if (isVenta(type)) entry.outflows += amount;
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
    .select("operation_type, eur_amount")
    .in("account_id", accountIds);

  if (error) throw error;

  let totalContributions = 0;
  let totalWithdrawals = 0;

  for (const op of data ?? []) {
    const amount = Math.abs(op.eur_amount ?? 0);
    const type = op.operation_type ?? "";
    if (isCompra(type)) totalContributions += amount;
    else if (isVenta(type)) totalWithdrawals += amount;
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
