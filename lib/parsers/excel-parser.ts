import * as XLSX from "xlsx";

import {
  PositionSchema,
  OperationSchema,
  CashBalanceSchema,
  POSITION_COLUMN_ALIASES,
  OPERATION_COLUMN_ALIASES,
  CASH_BALANCE_COLUMN_ALIASES,
} from "@/lib/types/excel";

import type {
  Position,
  Operation,
  CashBalance,
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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convierte una fecha en formato DD/MM/YYYY o DD-MM-YYYY a un objeto Date.
 * Retorna null si el formato no es valido.
 */
function parseEuropeanDate(raw: unknown): Date | null {
  if (raw instanceof Date) return raw;

  if (typeof raw === "number") {
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
 */
function parseEuropeanNumber(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }

  if (typeof raw !== "string") return null;

  const trimmed = raw.trim().replace(/\s/g, "");
  if (trimmed === "" || trimmed === "-") return null;

  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);

  return Number.isFinite(num) ? num : null;
}

/**
 * Busca la primera hoja valida en un workbook.
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

  for (const hint of hints) {
    const normalizedHint = normalize(hint);
    const found = names.find((n) => normalize(n).includes(normalizedHint));
    if (found) {
      return workbook.Sheets[found];
    }
  }

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
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  if (rawRows.length === 0) {
    return { rows: [], columnMap: {} };
  }

  let headerRowIndex = -1;
  let columnMap: Record<string, string> = {};

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

  const dataRows: Record<string, unknown>[] = [];

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

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

function createStats(): ParseStats {
  return {
    totalRows: 0,
    validRows: 0,
    skippedRows: 0,
    errors: [],
  };
}

function readWorkbook(buffer: Buffer): XLSX.WorkBook {
  return XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    cellNF: false,
    cellStyles: false,
  });
}

// ===========================================================================
// Parser: POSICIONES
// ===========================================================================

/**
 * Parsea un archivo Excel de posiciones de Mapfre.
 * Sheet: "Consulta masiva Posiciones"
 */
export function parsePositions(buffer: Buffer): ParseResult<Position> {
  const stats = createStats();
  const workbook = readWorkbook(buffer);
  const sheet = findSheet(workbook, [
    "consulta masiva posiciones",
    "posiciones",
    "posicion",
  ]);

  const { rows } = extractRows(sheet, POSITION_COLUMN_ALIASES, 5);
  stats.totalRows = rows.length;

  if (rows.length === 0) {
    return { data: [], stats };
  }

  const data: Position[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    try {
      const snapshotDate = parseEuropeanDate(row.snapshotDate);
      if (!snapshotDate) {
        stats.skippedRows++;
        stats.errors.push(`Fila ${rowNum}: fecha invalida → "${String(row.snapshotDate)}"`);
        continue;
      }

      const accountNumber = String(row.accountNumber ?? "").trim();
      if (!accountNumber) {
        stats.skippedRows++;
        stats.errors.push(`Fila ${rowNum}: cuenta de valores vacia`);
        continue;
      }

      const units = parseEuropeanNumber(row.units);
      const avgCost = parseEuropeanNumber(row.avgCost);
      const marketPrice = parseEuropeanNumber(row.marketPrice);
      const positionValue = parseEuropeanNumber(row.positionValue);

      if (units === null || avgCost === null || marketPrice === null || positionValue === null) {
        stats.skippedRows++;
        stats.errors.push(
          `Fila ${rowNum}: numero invalido (units=${String(row.units)}, avgCost=${String(row.avgCost)}, ` +
            `marketPrice=${String(row.marketPrice)}, positionValue=${String(row.positionValue)})`,
        );
        continue;
      }

      const fxRate = parseEuropeanNumber(row.fxRate) ?? 1;
      const purchaseDate = parseEuropeanDate(row.purchaseDate) ?? undefined;

      const candidate = {
        snapshotDate,
        accountNumber,
        isin: String(row.isin ?? "").trim(),
        productName: String(row.productName ?? "").trim(),
        manager: row.manager ? String(row.manager).trim() : undefined,
        currency: String(row.currency ?? "EUR").trim() || "EUR",
        units,
        avgCost,
        marketPrice,
        positionValue,
        fxRate,
        purchaseDate,
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
// Parser: SALDOS DE EFECTIVO
// ===========================================================================

/**
 * Parsea un archivo Excel de saldos de efectivo de Mapfre.
 * Sheet: "Consulta masiva saldos"
 */
export function parseCashBalances(buffer: Buffer): ParseResult<CashBalance> {
  const stats = createStats();
  const workbook = readWorkbook(buffer);
  const sheet = findSheet(workbook, [
    "consulta masiva saldos",
    "saldos",
    "saldo",
    "efectivo",
  ]);

  const { rows } = extractRows(sheet, CASH_BALANCE_COLUMN_ALIASES, 3);
  stats.totalRows = rows.length;

  if (rows.length === 0) {
    return { data: [], stats };
  }

  const data: CashBalance[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    try {
      const snapshotDate = parseEuropeanDate(row.snapshotDate);
      if (!snapshotDate) {
        stats.skippedRows++;
        stats.errors.push(`Fila ${rowNum}: fecha invalida → "${String(row.snapshotDate)}"`);
        continue;
      }

      const cashAccountNumber = String(row.cashAccountNumber ?? "").trim();
      if (!cashAccountNumber) {
        stats.skippedRows++;
        stats.errors.push(`Fila ${rowNum}: cuenta de efectivo vacia`);
        continue;
      }

      const balance = parseEuropeanNumber(row.balance) ?? 0;

      // Apply sign to balance value
      const sign = String(row.sign ?? "+").trim() || "+";
      const signedBalance = sign === "-" ? -Math.abs(balance) : Math.abs(balance);

      const candidate = {
        snapshotDate,
        cashAccountNumber,
        currency: String(row.currency ?? "EUR").trim() || "EUR",
        balance: signedBalance,
        sign,
      };

      const result = CashBalanceSchema.safeParse(candidate);

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

/**
 * Parsea un archivo Excel de operaciones historicas de Mapfre.
 * Sheet: "Consulta masiva Operaciones"
 */
export function parseOperations(buffer: Buffer): ParseResult<Operation> {
  const stats = createStats();
  const workbook = readWorkbook(buffer);
  const sheet = findSheet(workbook, [
    "consulta masiva operaciones",
    "operaciones",
    "movimientos",
  ]);

  const { rows } = extractRows(sheet, OPERATION_COLUMN_ALIASES, 5);
  stats.totalRows = rows.length;

  if (rows.length === 0) {
    return { data: [], stats };
  }

  const data: Operation[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    try {
      const operationDate = parseEuropeanDate(row.operationDate);
      if (!operationDate) {
        stats.skippedRows++;
        stats.errors.push(`Fila ${rowNum}: fecha invalida → "${String(row.operationDate)}"`);
        continue;
      }

      const accountNumber = String(row.accountNumber ?? "").trim();
      if (!accountNumber) {
        stats.skippedRows++;
        stats.errors.push(`Fila ${rowNum}: cuenta valores cliente vacia`);
        continue;
      }

      const operationType = String(row.operationType ?? "").trim();
      if (!operationType) {
        stats.skippedRows++;
        stats.errors.push(`Fila ${rowNum}: tipo de operacion vacio`);
        continue;
      }

      const settlementDate = parseEuropeanDate(row.settlementDate) ?? undefined;

      const candidate = {
        operationNumber: String(row.operationNumber ?? "").trim(),
        operationType,
        isin: row.isin ? String(row.isin).trim() : undefined,
        productName: row.productName ? String(row.productName).trim() : undefined,
        accountNumber,
        operationDate,
        settlementDate,
        currency: String(row.currency ?? "EUR").trim() || "EUR",
        units: parseEuropeanNumber(row.units) ?? undefined,
        grossAmount: parseEuropeanNumber(row.grossAmount) ?? undefined,
        netAmount: parseEuropeanNumber(row.netAmount) ?? undefined,
        fxRate: parseEuropeanNumber(row.fxRate) ?? 1,
        eurAmount: parseEuropeanNumber(row.eurAmount) ?? undefined,
        withholding: parseEuropeanNumber(row.withholding) ?? 0,
        commission: parseEuropeanNumber(row.commission) ?? 0,
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
// Clasificacion de operaciones (delegada a taxonomia oficial)
// ===========================================================================
//
// La taxonomia PLUS / MINUS / NEUTRO esta definida en lib/operations-taxonomy.ts
// segun la spec de Edgard. Mantenemos esta funcion como wrapper porque otros
// modulos importan classifyOperation y OperationCategory.

import { classifyFlow } from "@/lib/operations-taxonomy";

export type OperationCategory = "compra" | "venta" | "neutro";

export function classifyOperation(operationType: string): OperationCategory {
  const cat = classifyFlow(operationType);
  if (cat === "plus") return "compra";
  if (cat === "minus") return "venta";
  return "neutro";
}

// ===========================================================================
// Deteccion de tipo de archivo por nombre
// ===========================================================================

export type FileType = "posiciones" | "saldos" | "operaciones" | "unknown";

export function detectFileType(fileName: string): FileType {
  const lower = fileName.toLowerCase();
  if (lower.includes("_pos") || lower.includes("posicion")) return "posiciones";
  if (lower.includes("_saldo") || lower.includes("saldo")) return "saldos";
  if (lower.includes("operacion") || lower.includes("registro")) return "operaciones";
  return "unknown";
}

// ===========================================================================
// Utilidad: extraer cuentas unicas
// ===========================================================================

/**
 * Extrae todas las cuentas de valores unicas de los datos parseados.
 * Util para auto-crear accounts en Supabase.
 */
export function extractUniqueAccounts(
  positions: Position[],
  operations: Operation[],
): string[] {
  const accounts = new Set<string>();

  for (const p of positions) {
    accounts.add(p.accountNumber);
  }

  for (const o of operations) {
    accounts.add(o.accountNumber);
  }

  return Array.from(accounts).sort();
}
