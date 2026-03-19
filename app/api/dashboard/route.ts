import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getLatestPositions,
  getPositionHistory,
  getAggregatedPositions,
  getAggregatedHistory,
} from "@/lib/queries/positions";
import { getOperations } from "@/lib/queries/operations";
import { getCashBalances } from "@/lib/queries/balances";

/**
 * GET /api/dashboard
 *
 * Params:
 *   account  - UUID de la cuenta (o vacio para todas)
 *   accounts - JSON array de UUIDs (para multi-cuenta)
 *   year     - Ano numerico (2024, 2025...)
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
  const yearStr = params.get("year");
  const pageStr = params.get("page");

  const year = yearStr ? parseInt(yearStr, 10) : undefined;
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
        ? getLatestPositions(primaryAccountId, year)
        : getAggregatedPositions(accountIds, year),
      isSingle
        ? getPositionHistory(primaryAccountId, year)
        : getAggregatedHistory(accountIds, year),
      // Operaciones solo para single-account
      isSingle
        ? getOperations(primaryAccountId, { year, page, pageSize: 25 })
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

    return NextResponse.json({
      accountId: isSingle ? primaryAccountId : "all",
      year: year ?? null,
      positions,
      history,
      operations: {
        operations: opsResult.operations,
        total: opsResult.total,
        page: opsResult.page,
        totalPages: opsResult.totalPages,
      },
      cashBalance,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Error obteniendo datos" },
      { status: 500 }
    );
  }
}
