import { z } from "zod";

// ===========================================================================
// Zod Schemas — Validacion de filas parseadas de los Excel de Mapfre
// ===========================================================================

/**
 * Schema para una posicion individual del portfolio.
 * Mapea las columnas: FECHA, ISIN, NOMBRE PRODUCTO, TOTAL TITULOS,
 * COSTE MEDIO, PRECIO MERCADO, POSICION.
 */
export const PositionSchema = z.object({
  /** Fecha del extracto */
  date: z.date(),
  /** Codigo ISIN del instrumento (ej. ES0138011009) */
  isin: z.string().min(1),
  /** Nombre del producto/fondo */
  productName: z.string().min(1),
  /** Numero de participaciones / titulos */
  shares: z.number().finite(),
  /** Coste medio de adquisicion por titulo (EUR) */
  avgCost: z.number().finite(),
  /** Precio de mercado actual por titulo (EUR) */
  marketPrice: z.number().finite(),
  /** Valor total de la posicion (EUR) */
  totalValue: z.number().finite(),
});

/**
 * Schema para una operacion (compra, venta, etc.).
 * Mapea las columnas: FECHA, TIPO, ISIN, NOMBRE, IMPORTE, TITULOS.
 */
export const OperationSchema = z.object({
  /** Fecha de la operacion */
  date: z.date(),
  /** Tipo: Compra | Venta | Aportacion | Reembolso */
  type: z.enum(["Compra", "Venta", "Aportacion", "Reembolso"]),
  /** Codigo ISIN del instrumento */
  isin: z.string().min(1),
  /** Nombre del producto */
  name: z.string().min(1),
  /** Importe de la operacion (EUR) */
  amount: z.number().finite(),
  /** Numero de titulos afectados */
  shares: z.number().finite(),
});

/**
 * Schema para un movimiento de liquidez.
 * Mapea las columnas: FECHA, TIPO, IMPORTE, SALDO.
 */
export const LiquiditySchema = z.object({
  /** Fecha del movimiento */
  date: z.date(),
  /** Descripcion del tipo de movimiento */
  type: z.string().min(1),
  /** Importe del movimiento (EUR) */
  amount: z.number().finite(),
  /** Saldo resultante tras el movimiento (EUR) */
  balance: z.number().finite(),
});

// ===========================================================================
// TypeScript types inferidos de los schemas
// ===========================================================================

/** Posicion individual del portfolio */
export type Position = z.infer<typeof PositionSchema>;

/** Operacion ejecutada */
export type Operation = z.infer<typeof OperationSchema>;

/** Movimiento de liquidez */
export type Liquidity = z.infer<typeof LiquiditySchema>;

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
// Mapeo de columnas esperadas por cada tipo de Excel
// ===========================================================================

/**
 * Aliases de columna: cada clave es el nombre canonico y el array
 * contiene variantes que Mapfre podria usar en los headers.
 * Se comparan en minusculas y sin acentos.
 */
export const POSITION_COLUMN_ALIASES: Record<string, string[]> = {
  date: ["fecha"],
  isin: ["isin", "cod isin", "codigo isin"],
  productName: ["nombre producto", "producto", "nombre", "descripcion"],
  shares: ["total titulos", "titulos", "participaciones", "num titulos"],
  avgCost: ["coste medio", "precio medio", "coste adquisicion"],
  marketPrice: ["precio mercado", "precio actual", "valoracion unitaria"],
  totalValue: ["posicion", "valor posicion", "importe", "valor total", "valoracion"],
};

export const OPERATION_COLUMN_ALIASES: Record<string, string[]> = {
  date: ["fecha", "fecha operacion", "fecha valor"],
  type: ["tipo", "tipo operacion"],
  isin: ["isin", "cod isin", "codigo isin"],
  name: ["nombre", "nombre producto", "producto", "descripcion"],
  amount: ["importe", "importe bruto", "importe neto", "valor"],
  shares: ["titulos", "participaciones", "num titulos", "total titulos"],
};

export const LIQUIDITY_COLUMN_ALIASES: Record<string, string[]> = {
  date: ["fecha", "fecha valor", "fecha operacion"],
  type: ["tipo", "concepto", "descripcion", "tipo movimiento"],
  amount: ["importe", "cargo/abono", "movimiento"],
  balance: ["saldo", "saldo disponible", "saldo actual"],
};
