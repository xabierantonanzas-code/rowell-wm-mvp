import { z } from "zod";

// ===========================================================================
// Zod Schemas — Validacion de filas parseadas de los Excel REALES de Mapfre
// Actualizados para mapear las columnas de los archivos descargados
// ===========================================================================

/**
 * Schema para una posicion individual del portfolio.
 * Sheet: "Consulta masiva Posiciones"
 * Columnas: FECHA, CUENTA DE VALORES, ISIN, NOMBRE PRODUCTO,
 * DESCRIPCION GESTORA, DIVISA, TOTAL TITULOS, COSTE MEDIO POSICION,
 * PRECIO MERCADO, POSICION, CAMBIO EUR, FECHA VALOR
 */
export const PositionSchema = z.object({
  snapshotDate: z.date(),
  accountNumber: z.string().min(1),
  isin: z.string().min(1),
  productName: z.string(),
  manager: z.string().optional(),
  currency: z.string().default("EUR"),
  units: z.number().finite(),
  avgCost: z.number().finite(),
  marketPrice: z.number().finite(),
  positionValue: z.number().finite(),
  fxRate: z.number().positive().default(1),
  purchaseDate: z.date().optional(),
});

/**
 * Schema para un saldo de efectivo.
 * Sheet: "Consulta masiva saldos"
 * Columnas: FECHA, CUENTA DE EFECTIVO, DIVISA, SALDO, SIGNO
 */
export const CashBalanceSchema = z.object({
  snapshotDate: z.date(),
  cashAccountNumber: z.string().min(1),
  currency: z.string().default("EUR"),
  balance: z.number().finite(),
  sign: z.string().default("+"),
});

/**
 * Schema para una operacion historica.
 * Sheet: "Consulta masiva Operaciones"
 * Columnas: NUMERO OPERACION, TIPO DE OPERACION IB, CODIGO ISIN,
 * NOMBRE PRODUCTO, CUENTA VALORES CLIENTE, FECHA DE CONTRATACION,
 * FECHA VALOR/EJEC/LIQUI, DIVISA, NUMERO DE TITULOS, EFECTIVO BRUTO,
 * EFECTIVO NETO, CAMBIO DE LA DIVISA, CONTRAVALOR EFECTIVO NETO,
 * IMPORTE RETENCION, IMPORTE COMISION
 */
export const OperationSchema = z.object({
  operationNumber: z.string(),
  operationType: z.string().min(1),
  isin: z.string().optional(),
  productName: z.string().optional(),
  accountNumber: z.string().min(1),
  operationDate: z.date(),
  settlementDate: z.date().optional(),
  currency: z.string().default("EUR"),
  units: z.number().finite().optional(),
  grossAmount: z.number().finite().optional(),
  netAmount: z.number().finite().optional(),
  fxRate: z.number().positive().default(1),
  eurAmount: z.number().finite().optional(),
  withholding: z.number().finite().default(0),
  commission: z.number().finite().default(0),
});

// ===========================================================================
// TypeScript types inferidos de los schemas
// ===========================================================================

/** Posicion individual del portfolio */
export type Position = z.infer<typeof PositionSchema>;

/** Saldo de efectivo */
export type CashBalance = z.infer<typeof CashBalanceSchema>;

/** Operacion ejecutada */
export type Operation = z.infer<typeof OperationSchema>;

// ===========================================================================
// Tipos genericos del parser
// ===========================================================================

/** Estadisticas de resultado del parsing */
export interface ParseStats {
  /** Filas totales encontradas (excluyendo headers) */
  totalRows: number;
  /** Filas que pasaron validacion Zod */
  validRows: number;
  /** Filas descartadas por datos invalidos */
  skippedRows: number;
  /** Mensajes de error/warning por cada fila descartada */
  errors: string[];
}

/** Resultado generico devuelto por cada funcion de parseo */
export interface ParseResult<T> {
  /** Array de objetos validados */
  data: T[];
  /** Estadisticas del proceso de parsing */
  stats: ParseStats;
}

// ===========================================================================
// Mapeo de columnas — Headers REALES de los archivos Mapfre
// Se comparan en minusculas y sin acentos via normalize()
// ===========================================================================

export const POSITION_COLUMN_ALIASES: Record<string, string[]> = {
  snapshotDate: ["fecha"],
  accountNumber: ["cuenta de valores"],
  isin: ["isin"],
  productName: ["nombre producto"],
  manager: ["descripcion gestora"],
  currency: ["divisa"],
  units: ["total titulos"],
  avgCost: ["coste medio posicion"],
  marketPrice: ["precio mercado"],
  positionValue: ["posicion"],
  fxRate: ["cambio eur"],
  purchaseDate: ["fecha valor"],
};

export const CASH_BALANCE_COLUMN_ALIASES: Record<string, string[]> = {
  snapshotDate: ["fecha"],
  cashAccountNumber: ["cuenta de efectivo"],
  currency: ["divisa"],
  balance: ["saldo"],
  sign: ["signo"],
};

export const OPERATION_COLUMN_ALIASES: Record<string, string[]> = {
  operationNumber: ["numero operacion"],
  operationType: ["tipo de operacion ib"],
  isin: ["codigo isin"],
  productName: ["nombre producto"],
  accountNumber: ["cuenta valores cliente"],
  operationDate: ["fecha de contratacion"],
  settlementDate: ["fecha valor/ejec/liqui"],
  currency: ["divisa"],
  units: ["numero de titulos"],
  grossAmount: ["efectivo bruto"],
  netAmount: ["efectivo neto"],
  fxRate: ["cambio de la divisa"],
  eurAmount: ["contravalor efectivo neto"],
  withholding: ["importe retencion"],
  commission: ["importe comision"],
};
