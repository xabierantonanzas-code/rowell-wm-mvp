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

    // Fetch en paralelo
    const [positions, history, opsResult] = await Promise.all([
      isSingle
        ? getLatestPositions(primaryAccountId, dateRange)
        : getAggregatedPositions(accountIds, dateRange),
      isSingle
        ? getPositionHistory(primaryAccountId, dateRange)
        : getAggregatedHistory(accountIds, dateRange),
      // Operaciones solo para single-account
      isSingle
        ? getOperations(primaryAccountId, { dateRange, page, pageSize: 25 })
        : Promise.resolve({ operations: [], total: 0, page: 1, totalPages: 0, pageSize: 25 }),
    ]);

    // Cash balance (solo single)
    let cashBalance = 0;
    if (isSingle) {
      const balances = await getCashBalances(primaryAccountId);
      cashBalance = balances.reduce(
        (sum, b) => sum + (b.balance ?? 0),
        0
      );
    }

    // Per-account history (for strategy chart, multi-account only)
    let historyByAccount: Record<string, { date: string; totalValue: number }[]> | undefined;
    if (!isSingle) {
      const histMap = await getHistoryByAccount(accountIds, dateRange);
      historyByAccount = Object.fromEntries(histMap);
    }

    return NextResponse.json({
      accountId: isSingle ? primaryAccountId : "all",
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      positions,
      history,
      historyByAccount,
      operations: {
        operations: opsResult.operations,
        total: opsResult.total,
        page: opsResult.page,
        totalPages: opsResult.totalPages,
      },
      cashBalance,
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
