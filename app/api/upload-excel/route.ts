import { NextRequest, NextResponse } from "next/server";
import {
  parsePositions,
  parseOperations,
  parseLiquidity,
} from "@/lib/parsers/excel-parser";
import type { ParseStats } from "@/lib/types/excel";

// ===========================================================================
// Constantes
// ===========================================================================

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
]);
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
  if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_TYPES.has(file.type)) {
    return `${label}: formato no soportado ("${file.name}"). Solo .xlsx o .xls.`;
  }

  return null;
}

/**
 * Serializa datos para JSON (convierte Date a ISO string).
 */
function serializeDates<T extends Record<string, unknown>>(
  items: T[],
): Record<string, unknown>[] {
  return items.map((item) => {
    const serialized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      serialized[key] = value instanceof Date ? value.toISOString() : value;
    }
    return serialized;
  });
}

// ===========================================================================
// POST /api/upload-excel
// ===========================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { success: false, error: "Content-Type debe ser multipart/form-data." },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    // --- Extraer archivos opcionales ---
    const posFile = formData.get("posiciones") as File | null;
    const opsFile = formData.get("operaciones") as File | null;
    const liqFile = formData.get("liquidez") as File | null;

    if (!posFile && !opsFile && !liqFile) {
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
    if (liqFile) {
      const err = validateFile(liqFile, "Liquidez");
      if (err) validationErrors.push(err);
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: validationErrors.join(" | ") },
        { status: 400 }
      );
    }

    // --- Parsear cada archivo ---
    let positions: Record<string, unknown>[] = [];
    let operations: Record<string, unknown>[] = [];
    let liquidity: Record<string, unknown>[] = [];

    let posStats: ParseStats = emptyStats();
    let opsStats: ParseStats = emptyStats();
    let liqStats: ParseStats = emptyStats();

    if (posFile) {
      const buffer = Buffer.from(await posFile.arrayBuffer());
      const result = parsePositions(buffer);
      positions = serializeDates(result.data as unknown as Record<string, unknown>[]);
      posStats = result.stats;
    }

    if (opsFile) {
      const buffer = Buffer.from(await opsFile.arrayBuffer());
      const result = parseOperations(buffer);
      operations = serializeDates(result.data as unknown as Record<string, unknown>[]);
      opsStats = result.stats;
    }

    if (liqFile) {
      const buffer = Buffer.from(await liqFile.arrayBuffer());
      const result = parseLiquidity(buffer);
      liquidity = serializeDates(result.data as unknown as Record<string, unknown>[]);
      liqStats = result.stats;
    }

    return NextResponse.json({
      success: true,
      data: {
        positions,
        operations,
        liquidity,
      },
      stats: {
        positions: posStats,
        operations: opsStats,
        liquidity: liqStats,
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
