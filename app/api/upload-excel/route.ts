import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRouteRateLimit } from "@/lib/security";
import {
  parsePositions,
  parseOperations,
  parseCashBalances,
  extractUniqueAccounts,
  detectFileType,
} from "@/lib/parsers/excel-parser";
import type { ParseStats } from "@/lib/types/excel";
import type { PositionInsert, OperationInsert, CashBalanceInsert } from "@/lib/types/database";

// ===========================================================================
// Constantes
// ===========================================================================

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls"]);

// ===========================================================================
// Helpers
// ===========================================================================

function emptyStats(): ParseStats {
  return { totalRows: 0, validRows: 0, skippedRows: 0, errors: [] };
}

function validateFile(file: File, label: string): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `${label}: archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximo permitido: 10MB.`;
  }

  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `${label}: formato no soportado ("${file.name}"). Solo .xlsx o .xls.`;
  }

  return null;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// ===========================================================================
// POST /api/upload-excel
// ===========================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit: 10 uploads per 15 min per IP
  const rl = checkRouteRateLimit(request, "upload", 10);
  if (rl) return rl;

  try {
    // --- Verificar autenticacion ---
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "No autenticado. Inicia sesion primero." },
        { status: 401 }
      );
    }

    // Verificar rol admin/owner
    const role = user.app_metadata?.role;
    if (role !== "admin" && role !== "owner") {
      return NextResponse.json(
        { success: false, error: "Solo el administrador puede subir archivos." },
        { status: 403 }
      );
    }

    // --- Validar content-type ---
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { success: false, error: "Content-Type debe ser multipart/form-data." },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    // --- Extraer archivos: campo específico o auto-detección ---
    let posFile = formData.get("posiciones") as File | null;
    let opsFile = formData.get("operaciones") as File | null;
    let salFile = formData.get("saldos") as File | null;

    // Auto-detect from generic "files" field
    const genericFiles = formData.getAll("files") as File[];
    for (const f of genericFiles) {
      const type = detectFileType(f.name);
      if (type === "posiciones" && !posFile) posFile = f;
      else if (type === "saldos" && !salFile) salFile = f;
      else if (type === "operaciones" && !opsFile) opsFile = f;
    }

    if (!posFile && !opsFile && !salFile) {
      return NextResponse.json(
        { success: false, error: "No se recibio ningun archivo. Sube al menos uno." },
        { status: 400 }
      );
    }

    // --- Validar archivos ---
    const validationErrors: string[] = [];
    if (posFile) {
      const err = validateFile(posFile, "Posiciones");
      if (err) validationErrors.push(err);
    }
    if (opsFile) {
      const err = validateFile(opsFile, "Operaciones");
      if (err) validationErrors.push(err);
    }
    if (salFile) {
      const err = validateFile(salFile, "Saldos");
      if (err) validationErrors.push(err);
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: validationErrors.join(" | ") },
        { status: 400 }
      );
    }

    // --- Usar service-role client para inserts (bypass RLS) ---
    const adminDb = createAdminClient();

    // --- Parsear archivos ---
    let posStats: ParseStats = emptyStats();
    let opsStats: ParseStats = emptyStats();
    let salStats: ParseStats = emptyStats();

    let parsedPositions: ReturnType<typeof parsePositions>["data"] = [];
    let parsedOperations: ReturnType<typeof parseOperations>["data"] = [];
    let parsedBalances: ReturnType<typeof parseCashBalances>["data"] = [];

    if (posFile) {
      const buffer = Buffer.from(await posFile.arrayBuffer());
      const result = parsePositions(buffer);
      parsedPositions = result.data;
      posStats = result.stats;
    }

    if (opsFile) {
      const buffer = Buffer.from(await opsFile.arrayBuffer());
      const result = parseOperations(buffer);
      parsedOperations = result.data;
      opsStats = result.stats;
    }

    if (salFile) {
      const buffer = Buffer.from(await salFile.arrayBuffer());
      const result = parseCashBalances(buffer);
      parsedBalances = result.data;
      salStats = result.stats;
    }

    // --- Auto-crear cuentas nuevas ---
    const accountNumbersFromData = extractUniqueAccounts(parsedPositions, parsedOperations);

    // Incluir cuentas de saldos
    for (const b of parsedBalances) {
      if (!accountNumbersFromData.includes(b.cashAccountNumber)) {
        accountNumbersFromData.push(b.cashAccountNumber);
      }
    }

    // Obtener cuentas existentes
    const { data: existingAccounts } = await adminDb
      .from("accounts")
      .select("id, account_number")
      .in("account_number", accountNumbersFromData.length > 0 ? accountNumbersFromData : ["__none__"]);

    const accountMap = new Map<string, string>();
    if (existingAccounts) {
      for (const acc of existingAccounts as { id: string; account_number: string }[]) {
        accountMap.set(acc.account_number, acc.id);
      }
    }

    // Crear cuentas que no existen
    const newAccountNumbers = accountNumbersFromData.filter(
      (num) => !accountMap.has(num)
    );

    if (newAccountNumbers.length > 0) {
      const { data: newAccounts, error: insertError } = await adminDb
        .from("accounts")
        .insert(
          newAccountNumbers.map((num) => ({
            account_number: num,
          }))
        )
        .select("id, account_number");

      if (insertError) {
        console.error("Error creando cuentas:", insertError);
      } else if (newAccounts) {
        for (const acc of newAccounts as { id: string; account_number: string }[]) {
          accountMap.set(acc.account_number, acc.id);
        }
      }
    }

    // --- Insertar posiciones ---
    let posInserted = 0;
    if (parsedPositions.length > 0) {
      const positionRows: PositionInsert[] = parsedPositions
        .filter((p) => accountMap.has(p.accountNumber))
        .map((p) => ({
          account_id: accountMap.get(p.accountNumber)!,
          snapshot_date: formatDate(p.snapshotDate),
          isin: p.isin,
          product_name: p.productName,
          manager: p.manager ?? null,
          currency: p.currency,
          units: p.units,
          avg_cost: p.avgCost,
          market_price: p.marketPrice,
          position_value: p.positionValue,
          fx_rate: p.fxRate,
          purchase_date: p.purchaseDate ? formatDate(p.purchaseDate) : null,
        }));

      // Upsert en batches de 500
      for (let i = 0; i < positionRows.length; i += 500) {
        const batch = positionRows.slice(i, i + 500);
        const { error } = await adminDb
          .from("positions")
          .upsert(batch, { onConflict: "account_id,snapshot_date,isin" });

        if (error) {
          console.error(`Error insertando posiciones batch ${i}:`, error);
          // Retry once
          const { error: retryError } = await adminDb
            .from("positions")
            .upsert(batch, { onConflict: "account_id,snapshot_date,isin" });
          if (retryError) {
            console.error(`Retry fallido posiciones batch ${i}:`, retryError);
          } else {
            posInserted += batch.length;
          }
        } else {
          posInserted += batch.length;
        }
      }
    }

    // --- Insertar saldos ---
    let salInserted = 0;
    if (parsedBalances.length > 0) {
      const balanceRows: CashBalanceInsert[] = parsedBalances
        .filter((b) => accountMap.has(b.cashAccountNumber))
        .map((b) => ({
          account_id: accountMap.get(b.cashAccountNumber)!,
          snapshot_date: formatDate(b.snapshotDate),
          cash_account_number: b.cashAccountNumber,
          currency: b.currency,
          balance: b.balance,
          sign: b.sign,
        }));

      for (let i = 0; i < balanceRows.length; i += 500) {
        const batch = balanceRows.slice(i, i + 500);
        const { error } = await adminDb
          .from("cash_balances")
          .upsert(batch, { onConflict: "account_id,snapshot_date,cash_account_number" });

        if (error) {
          console.error(`Error insertando saldos batch ${i}:`, error);
        } else {
          salInserted += batch.length;
        }
      }
    }

    // --- Insertar operaciones (dedup por operation_number) ---
    let opsInserted = 0;
    if (parsedOperations.length > 0) {
      const opNumbers = parsedOperations
        .map((o) => o.operationNumber)
        .filter(Boolean);

      let existingOpNumbers = new Set<string>();

      if (opNumbers.length > 0) {
        // Consultar en batches (Supabase limita IN queries)
        for (let i = 0; i < opNumbers.length; i += 1000) {
          const batch = opNumbers.slice(i, i + 1000);
          const { data: existingOps } = await adminDb
            .from("operations")
            .select("operation_number")
            .in("operation_number", batch);

          if (existingOps) {
            for (const o of existingOps) {
              if (o.operation_number) existingOpNumbers.add(o.operation_number);
            }
          }
        }
      }

      const newOperations: OperationInsert[] = parsedOperations
        .filter(
          (o) =>
            accountMap.has(o.accountNumber) &&
            !existingOpNumbers.has(o.operationNumber)
        )
        .map((o) => ({
          account_id: accountMap.get(o.accountNumber)!,
          operation_number: o.operationNumber,
          operation_type: o.operationType,
          isin: o.isin ?? null,
          product_name: o.productName ?? null,
          operation_date: formatDate(o.operationDate),
          settlement_date: o.settlementDate ? formatDate(o.settlementDate) : null,
          currency: o.currency,
          units: o.units ?? null,
          gross_amount: o.grossAmount ?? null,
          net_amount: o.netAmount ?? null,
          fx_rate: o.fxRate,
          eur_amount: o.eurAmount ?? null,
          withholding: o.withholding,
          commission: o.commission,
        }));

      for (let i = 0; i < newOperations.length; i += 500) {
        const batch = newOperations.slice(i, i + 500);
        const { error } = await adminDb.from("operations").insert(batch);

        if (error) {
          console.error(`Error insertando operaciones batch ${i}:`, error);
        } else {
          opsInserted += batch.length;
        }
      }
    }

    // Invalidate cache after data upload
    const { invalidateCache } = await import("@/lib/cache");
    invalidateCache("all_");

    // Refresh vista materializada client_summary (MVP6 P2.4).
    // Si la vista no existe todavia (migracion 007 sin aplicar), ignoramos
    // el error - el resto del upload sigue funcionando.
    try {
      const refreshResult = await adminDb.rpc("refresh_client_summary");
      if (refreshResult.error) {
        console.warn(
          "[upload] refresh_client_summary fallo (migracion pendiente?):",
          refreshResult.error.message
        );
      }
    } catch (e) {
      console.warn("[upload] refresh_client_summary throw:", e);
    }

    // --- Registrar upload ---
    await adminDb.from("uploads").insert({
      uploaded_by: user.id,
      file_names: [posFile?.name, opsFile?.name, salFile?.name].filter(Boolean) as string[],
      rows_inserted: posInserted + opsInserted + salInserted,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      inserted: {
        positions: posInserted,
        operations: opsInserted,
        balances: salInserted,
        newAccounts: newAccountNumbers.length,
      },
      stats: {
        positions: posStats,
        operations: opsStats,
        balances: salStats,
      },
    });
  } catch (err) {
    console.error("Error en /api/upload-excel:", err);

    const message =
      err instanceof Error
        ? err.message
        : "Error interno del servidor al procesar los archivos.";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
