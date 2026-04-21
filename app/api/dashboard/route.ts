import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRouteRateLimit } from "@/lib/security";
import {
  getLatestPositions,
  getPositionHistory,
  getAggregatedPositions,
  getAggregatedHistory,
  getHistoryByAccount,
} from "@/lib/queries/positions";
import type { DateRange } from "@/lib/queries/positions";
import { getAllOperationsForAccounts } from "@/lib/queries/operations";
import { getCashBalances } from "@/lib/queries/balances";
import { cached } from "@/lib/cache";

/**
 * GET /api/dashboard
 *
 * Params:
 *   account  - UUID de la cuenta (o vacio para todas)
 *   accounts - JSON array de UUIDs (para multi-cuenta)
 *   dateFrom - Fecha inicio (YYYY-MM-DD)
 *   dateTo   - Fecha fin (YYYY-MM-DD)
 */
export async function GET(req: NextRequest) {
  const rl = checkRouteRateLimit(req, "dashboard", 100);
  if (rl) return rl;

  const supabase = await createClient();

  // Verificar auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const accountId = params.get("account") ?? undefined;
  const accountsParam = params.get("accounts");
  const rawDateFrom = params.get("dateFrom") ?? undefined;
  const rawDateTo = params.get("dateTo") ?? undefined;
  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const dateFrom = rawDateFrom && dateRegex.test(rawDateFrom) ? rawDateFrom : undefined;
  const dateTo = rawDateTo && dateRegex.test(rawDateTo) ? rawDateTo : undefined;

  const dateRange: DateRange | undefined =
    dateFrom || dateTo ? { dateFrom, dateTo } : undefined;

  // Determinar que cuentas usar
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let accountIds: string[] = [];

  if (accountId) {
    if (!uuidRegex.test(accountId)) {
      return NextResponse.json({ error: "account ID invalido" }, { status: 400 });
    }
    accountIds = [accountId];
  } else if (accountsParam) {
    try {
      const parsed = JSON.parse(accountsParam);
      if (!Array.isArray(parsed) || !parsed.every((id: unknown) => typeof id === "string" && uuidRegex.test(id))) {
        return NextResponse.json({ error: "accounts param invalido" }, { status: 400 });
      }
      accountIds = parsed;
    } catch {
      return NextResponse.json(
        { error: "accounts param invalido" },
        { status: 400 }
      );
    }
  }

  if (accountIds.length === 0) {
    return NextResponse.json(
      { error: "Se requiere account o accounts" },
      { status: 400 }
    );
  }

  try {
    // Decidir si es single-account o multi-account
    const isSingle = accountIds.length === 1;
    const primaryAccountId = accountIds[0];

    // Cache key: positions + history + cash (no cambian en 5 min)
    const baseCacheKey = `dash_${accountIds.sort().join("_")}_${dateFrom ?? ""}_${dateTo ?? ""}`;

    // Fetch positions, history, cash con cache de 5 min
    const baseData = await cached(baseCacheKey, 300, async () => {
      const [positions, history, cashResult] = await Promise.all([
        isSingle
          ? getLatestPositions(primaryAccountId, dateRange)
          : getAggregatedPositions(accountIds, dateRange),
        isSingle
          ? getPositionHistory(primaryAccountId, dateRange)
          : getAggregatedHistory(accountIds, dateRange),
        isSingle
          ? getCashBalances(primaryAccountId).then((b) =>
              b.reduce((sum, x) => sum + (x.balance ?? 0), 0)
            )
          : Promise.resolve(0),
      ]);

      // Per-account history (for strategy chart, multi-account only)
      let historyByAccount:
        | Record<string, { date: string; totalValue: number }[]>
        | undefined;
      if (!isSingle) {
        const histMap = await getHistoryByAccount(accountIds, dateRange);
        historyByAccount = Object.fromEntries(histMap);
      }

      return { positions, history, cashBalance: cashResult, historyByAccount };
    });

    // All operations (no pagination) — needed for flow calculations,
    // originDate, FIFO, productTypeMap. The UI paginates client-side.
    const allOps = await getAllOperationsForAccounts(accountIds, dateRange);

    return NextResponse.json({
      accountId: isSingle ? primaryAccountId : "all",
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      positions: baseData.positions,
      history: baseData.history,
      historyByAccount: baseData.historyByAccount,
      operations: {
        operations: allOps,
        total: allOps.length,
        page: 1,
        totalPages: Math.max(1, Math.ceil(allOps.length / 25)),
      },
      cashBalance: baseData.cashBalance,
    });
  } catch (error) {
    const { captureError } = await import("@/lib/error");
    captureError(error, "Dashboard API");
    return NextResponse.json(
      { error: "Error obteniendo datos" },
      { status: 500 }
    );
  }
}
