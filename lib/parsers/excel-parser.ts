import * as XLSX from "xlsx";

import {
  PositionSchema,
  OperationSchema,
  LiquiditySchema,
  POSITION_COLUMN_ALIASES,
  OPERATION_COLUMN_ALIASES,
  LIQUIDITY_COLUMN_ALIASES,
} from "@/lib/types/excel";

import type {
  Position,
  Operation,
  Liquidity,
  ParseResult,
  ParseStats,
} from "@/lib/types/excel";

// ===========================================================================
// Utilidades internas
// ===========================================================================

/**
 * Normaliza un string para comparacion: minusculas, sin acentos,
 * sin espacios extra.
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convierte una fecha en formato DD/MM/YYYY a un objeto Date.
 * Retorna null si el formato no es valido.
 *
 * @example
 * parseEuropeanDate("15/03/2024") // → Date(2024, 2, 15)
 * parseEuropeanDate("invalid")    // → null
 */
function parseEuropeanDate(raw: unknown): Date | null {
  if (raw instanceof Date) return raw;

  if (typeof raw === "number") {
    // Excel serial date number
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) {
      return new Date(parsed.y, parsed.m - 1, parsed.d);
    }
    return null;
  }

  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);

  // Verificar que la fecha es valida (ej. 31/02 no lo es)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Convierte un numero en formato europeo "1.234,56" a number 1234.56.
 * Tambien acepta numeros ya parseados.
 * Retorna null si no puede convertir.
 *
 * @example
 * parseEuropeanNumber("1.234,56")  // → 1234.56
 * parseEuropeanNumber("-500,00")   // → -500
 * parseEuropeanNumber(42)          // → 42
 */
function parseEuropeanNumber(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }

  if (typeof raw !== "string") return null;

  const trimmed = raw.trim().replace(/\s/g, "");
  if (trimmed === "" || trimmed === "-") return null;

  // Formato europeo: quitar puntos de millar, cambiar coma por punto
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);

  return Number.isFinite(num) ? num : null;
}

/**
 * Busca la primera hoja valida en un workbook. Estrategia:
 * 1. Si hay una sola hoja, usar esa.
 * 2. Si alguna hoja coincide con los nombres hint, usar esa.
 * 3. Usar la primera hoja.
 */
function findSheet(
  workbook: XLSX.WorkBook,
  hints: string[],
): XLSX.WorkSheet {
  const names = workbook.SheetNames;

  if (names.length === 0) {
    throw new Error("El archivo Excel no contiene ninguna hoja.");
  }

  if (names.length === 1) {
    return workbook.Sheets[names[0]];
  }

  // Buscar por nombre hint
  for (const hint of hints) {
    const normalizedHint = normalize(hint);
    const found = names.find((n) => normalize(n).includes(normalizedHint));
    if (found) {
      return workbook.Sheets[found];
    }
  }

  // Fallback: primera hoja
  return workbook.Sheets[names[0]];
}

/**
 * Extrae las filas de una hoja como array de objetos clave-valor.
 * Detecta automaticamente la fila de headers buscando la primera fila
 * que contenga al menos `minMatchingHeaders` columnas reconocidas.
 */
function extractRows(
  sheet: XLSX.WorkSheet,
  columnAliases: Record<string, string[]>,
  minMatchingHeaders: number,
): { rows: Record<string, unknown>[]; columnMap: Record<string, string> } {
  // Convertir toda la hoja a array de arrays (sin parsear fechas/numeros)
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  if (rawRows.length === 0) {
    return { rows: [], columnMap: {} };
  }

  // --- Detectar fila de headers ---
  let headerRowIndex = -1;
  let columnMap: Record<string, string> = {}; // canonicalName → headerText

  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

    const candidateMap: Record<string, number> = {};
    let matches = 0;

    for (let col = 0; col < row.length; col++) {
      const cellValue = row[col];
      if (cellValue == null || typeof cellValue !== "string") continue;

      const normalizedCell = normalize(String(cellValue));

      for (const [canonical, aliases] of Object.entries(columnAliases)) {
        if (candidateMap[canonical] !== undefined) continue;

        for (const alias of aliases) {
          if (normalizedCell.includes(normalize(alias))) {
            candidateMap[canonical] = col;
            matches++;
            break;
          }
        }
      }
    }

    if (matches >= minMatchingHeaders) {
      headerRowIndex = i;
      // Guardar mapeo canonical → indice de columna
      columnMap = Object.fromEntries(
        Object.entries(candidateMap).map(([key, colIdx]) => [
          key,
          String(colIdx),
        ]),
      );
      break;
    }
  }

  if (headerRowIndex === -1) {
    const expected = Object.keys(columnAliases).join(", ");
    throw new Error(
      `No se encontraron las columnas esperadas en las primeras 15 filas. ` +
        `Columnas buscadas: ${expected}. ` +
        `Verifica que el archivo Excel tiene los headers correctos.`,
    );
  }

  // --- Convertir filas de datos a objetos ---
  const dataRows: Record<string, unknown>[] = [];

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

    // Ignorar filas completamente vacias
    const hasData = row.some(
      (cell) => cell != null && String(cell).trim() !== "",
    );
    if (!hasData) continue;

    const obj: Record<string, unknown> = {};
    for (const [canonical, colIdxStr] of Object.entries(columnMap)) {
      const colIdx = parseInt(colIdxStr, 10);
      obj[canonical] = row[colIdx] ?? null;
    }
    dataRows.push(obj);
  }

  return { rows: dataRows, columnMap };
}

/**
 * Crea un objeto ParseStats inicial.
 */
function createStats(): ParseStats {
  return {
    totalRows: 0,
    validRows: 0,
    skippedRows: 0,
    errors: [],
  };
}

/**
 * Lee un workbook XLSX a partir de un Buffer.
 * NO usa el filesystem (compatible con Edge Runtime).
 */
function readWorkbook(buffer: Buffer): XLSX.WorkBook {
  return XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,    // manejar fechas manualmente
    cellNF: false,
    cellStyles: false,
  });
}

// ===========================================================================
// Parser: POSICIONES
// ===========================================================================

/**
 * Parsea un archivo Excel de posiciones de Mapfre.
 *
 * @param buffer - Buffer del archivo .xlsx
 * @returns Posiciones validadas y estadisticas del parsing
 *
 * @example
 * ```ts
 * const file = await readFile("posiciones_enero.xlsx");
 * const { data, stats } = parsePositions(file);
 * console.log(`${stats.validRows} posiciones parseadas`);
 * ```
 */
export function parsePositions(buffer: Buffer): ParseResult<Position> {
  const stats = createStats();
  const workbook = readWorkbook(buffer);
  const sheet = findSheet(workbook, ["posiciones", "posicion", "cartera"]);

  const { rows } = extractRows(
    sheet,
    POSITION_COLUMN_ALIASES,
    4, // minimo 4 columnas reconocidas para validar header
  );

  stats.totalRows = rows.length;

  if (rows.length === 0) {
    return { data: [], stats };
  }

  const data: Position[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    try {
      const date = parseEuropeanDate(row.date);
      if (!date) {
        stats.skippedRows++;
        stats.errors.push(`Fila ${rowNum}: fecha invalida → "${String(row.date)}"`);
        continue;
      }

      const shares = parseEuropeanNumber(row.shares);
      const avgCost = parseEuropeanNumber(row.avgCost);
      const marketPrice = parseEuropeanNumber(row.marketPrice);
      const totalValue = parseEuropeanNumber(row.totalValue);

      if (shares === null || avgCost === null || marketPrice === null || totalValue === null) {
        stats.skippedRows++;
        stats.errors.push(
          `Fila ${rowNum}: numero invalido en campos numericos ` +
            `(shares=${String(row.shares)}, avgCost=${String(row.avgCost)}, ` +
            `marketPrice=${String(row.marketPrice)}, totalValue=${String(row.totalValue)})`,
        );
        continue;
      }

      const candidate = {
        date,
        isin: String(row.isin ?? "").trim(),
        productName: String(row.productName ?? "").trim(),
        shares,
        avgCost,
        marketPrice,
        totalValue,
      };

      const result = PositionSchema.safeParse(candidate);

      if (result.success) {
        data.push(result.data);
        stats.validRows++;
      } else {
        stats.skippedRows++;
        const issues = result.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
        stats.errors.push(`Fila ${rowNum}: validacion Zod fallida → ${issues}`);
      }
    } catch (err) {
      stats.skippedRows++;
      stats.errors.push(
        `Fila ${rowNum}: error inesperado → ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { data, stats };
}

// ===========================================================================
// Parser: OPERACIONES
// ===========================================================================

/** Mapa para normalizar tipos de operacion con variantes */
const OPERATION_TYPE_MAP: Record<string, Operation["type"]> = {
  compra: "Compra",
  venta: "Venta",
  aportacion: "Aportacion",
  aportación: "Aportacion",
  reembolso: "Reembolso",
  suscripcion: "Compra",
  suscripción: "Compra",
};

/**
 * Parsea un archivo Excel de operaciones de Mapfre.
 *
 * @param buffer - Buffer del archivo .xlsx
 * @returns Operaciones validadas y estadisticas del parsing
 *
 * @example
 * ```ts
 * const file = await readFile("operaciones_enero.xlsx");
 * const { data, stats } = parseOperations(file);
 * console.log(`${stats.validRows} operaciones parseadas`);
 * ```
 */
export function parseOperations(buffer: Buffer): ParseResult<Operation> {
  const stats = createStats();
  const workbook = readWorkbook(buffer);
  const sheet = findSheet(workbook, ["operaciones", "movimientos", "ordenes"]);

  const { rows } = extractRows(
    sheet,
    OPERATION_COLUMN_ALIASES,
    4,
  );

  stats.totalRows = rows.length;

  if (rows.length === 0) {
    return { data: [], stats };
  }

  const data: Operation[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    try {
      const date = parseEuropeanDate(row.date);
      if (!date) {
        stats.skippedRows++;
        stats.errors.push(`Fila ${rowNum}: fecha invalida → "${String(row.date)}"`);
        continue;
      }

      // Normalizar tipo de operacion
      const rawType = normalize(String(row.type ?? ""));
      const operationType = OPERATION_TYPE_MAP[rawType];

      if (!operationType) {
        stats.skippedRows++;
        stats.errors.push(
          `Fila ${rowNum}: tipo de operacion desconocido → "${String(row.type)}"`,
        );
        continue;
      }

      const amount = parseEuropeanNumber(row.amount);
      const shares = parseEuropeanNumber(row.shares);

      if (amount === null || shares === null) {
        stats.skippedRows++;
        stats.errors.push(
          `Fila ${rowNum}: numero invalido (amount=${String(row.amount)}, shares=${String(row.shares)})`,
        );
        continue;
      }

      const candidate = {
        date,
        type: operationType,
        isin: String(row.isin ?? "").trim(),
        name: String(row.name ?? "").trim(),
        amount,
        shares,
      };

      const result = OperationSchema.safeParse(candidate);

      if (result.success) {
        data.push(result.data);
        stats.validRows++;
      } else {
        stats.skippedRows++;
        const issues = result.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
        stats.errors.push(`Fila ${rowNum}: validacion Zod fallida → ${issues}`);
      }
    } catch (err) {
      stats.skippedRows++;
      stats.errors.push(
        `Fila ${rowNum}: error inesperado → ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { data, stats };
}

// ===========================================================================
// Parser: LIQUIDEZ
// ===========================================================================

/**
 * Parsea un archivo Excel de movimientos de liquidez de Mapfre.
 *
 * @param buffer - Buffer del archivo .xlsx
 * @returns Movimientos de liquidez validados y estadisticas del parsing
 *
 * @example
 * ```ts
 * const file = await readFile("liquidez_enero.xlsx");
 * const { data, stats } = parseLiquidity(file);
 * console.log(`Saldo final: €${data.at(-1)?.balance}`);
 * ```
 */
export function parseLiquidity(buffer: Buffer): ParseResult<Liquidity> {
  const stats = createStats();
  const workbook = readWorkbook(buffer);
  const sheet = findSheet(workbook, ["liquidez", "efectivo", "cash", "saldo"]);

  const { rows } = extractRows(
    sheet,
    LIQUIDITY_COLUMN_ALIASES,
    3, // solo 4 columnas, con 3 matcheadas basta
  );

  stats.totalRows = rows.length;

  if (rows.length === 0) {
    return { data: [], stats };
  }

  const data: Liquidity[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    try {
      const date = parseEuropeanDate(row.date);
      if (!date) {
        stats.skippedRows++;
        stats.errors.push(`Fila ${rowNum}: fecha invalida → "${String(row.date)}"`);
        continue;
      }

      const amount = parseEuropeanNumber(row.amount);
      const balance = parseEuropeanNumber(row.balance);

      if (amount === null || balance === null) {
        stats.skippedRows++;
        stats.errors.push(
          `Fila ${rowNum}: numero invalido (amount=${String(row.amount)}, balance=${String(row.balance)})`,
        );
        continue;
      }

      const candidate = {
        date,
        type: String(row.type ?? "").trim(),
        amount,
        balance,
      };

      const result = LiquiditySchema.safeParse(candidate);

      if (result.success) {
        data.push(result.data);
        stats.validRows++;
      } else {
        stats.skippedRows++;
        const issues = result.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
        stats.errors.push(`Fila ${rowNum}: validacion Zod fallida → ${issues}`);
      }
    } catch (err) {
      stats.skippedRows++;
      stats.errors.push(
        `Fila ${rowNum}: error inesperado → ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { data, stats };
}
