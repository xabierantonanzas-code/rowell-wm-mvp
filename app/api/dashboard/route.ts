import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getLatestPositions,
  getPositionHistory,
  getAggregatedPositions,
  getAggregatedHistory,
  getHistoryByAccount,
} from "@/lib/queries/positions";
import type { DateRange } from "@/lib/queries/positions";
import { getOperations } from "@/lib/queries/operations";
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
 *   page     - Pagina de operaciones (default 1)
 */
export async function GET(req: NextRequest) {
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
  const pageStr = params.get("page");

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const dateFrom = rawDateFrom && dateRegex.test(rawDateFrom) ? rawDateFrom : undefined;
  const dateTo = rawDateTo && dateRegex.test(rawDateTo) ? rawDateTo : undefined;

  const dateRange: DateRange | undefined =
    dateFrom || dateTo ? { dateFrom, dateTo } : undefined;
  const page = pageStr ? parseInt(pageStr, 10) : 1;

  // Determinar que cuentas usar
  let accountIds: string[] = [];

  if (accountId) {
    accountIds = [accountId];
  } else if (accountsParam) {
    try {
      accountIds = JSON.parse(accountsParam);
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

    // Operations: paginated per request (page can change), not cached
    const opsResult = isSingle
      ? await getOperations(primaryAccountId, { dateRange, page, pageSize: 25 })
      : { operations: [], total: 0, page: 1, totalPages: 0, pageSize: 25 };

    return NextResponse.json({
      accountId: isSingle ? primaryAccountId : "all",
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      positions: baseData.positions,
      history: baseData.history,
      historyByAccount: baseData.historyByAccount,
      operations: {
        operations: opsResult.operations,
        total: opsResult.total,
        page: opsResult.page,
        totalPages: opsResult.totalPages,
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
