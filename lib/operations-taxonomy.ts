// ===========================================================================
// Taxonomia oficial de operaciones Mapfre (segun spec Edgard, abril 2026)
// ===========================================================================
//
// PLUS  -> aportacion real de capital a la cartera (aumenta posicion neta)
//          monto = CONTRAVALOR EFECTIVO NETO (col 24, "eur_amount")
//          la comision esta incluida en el coste medio.
//
// MINUS -> reembolso real desde la cartera (disminuye posicion neta)
//          monto = EFECTIVO BRUTO * CAMBIO DIVISA (cols 21*23, "gross_amount * fx_rate")
//          el cliente recibe contravalor neto (eur_amount) que difiere por
//          comisiones y/o retenciones, pero lo que sale de cartera es el bruto.
//
// NEUTRO -> traspasos internos, fusiones, splits, ajustes. No afectan
//           a flujos ni a aportaciones netas.
//
// IMPORTANTE: usar SIEMPRE FECHA DE CONTRATACION (col 14, "operation_date")
// como fecha del flujo, NO la fecha de liquidacion.

export const PLUS_TYPES = new Set([
  "SUSCRIPCIÓN FONDOS INVERSIÓN",
  "COMPRA RV CONTADO",
  "COMPRA SICAVS",
  "RECEPCION INTERNA IIC LP",
  "SUSC.TRASPASO EXT.",
]);

export const MINUS_TYPES = new Set([
  "VENTA RV CONTADO",
  "LIQUIDACION IICS",
  "TRASPASO INTERNO IIC LP",
  "REEMBOLSO FONDO INVERSIÓN",
  "REEMBOLSO OBLIGATORIO IIC",
  "REEMBOLSO POR TRASPASO EXT.",
]);

// NEUTRO explicito (para reportar / debug). Cualquier tipo no listado en
// PLUS o MINUS se considera neutro.
export const NEUTRO_TYPES = new Set([
  "AJUSTE PARTICIP SUSCRITAS",
  "ALTA DE NUEVO VALOR POR SPLIT",
  "BAJA SPLIT/CONTRASPLIT IICS",
  "ALTA IIC SWITCH",
  "ALTA SPLIT/CONTRASPLIT IICS",
  "BAJA DE VALOR POR SPLIT",
  "SUSCRIPCION POR FUSION",
  "REEMBOLSO POR FUSION",
  "SUSC.TRASPASO. INT.",
  "REEMBOLSO POR TRASPASO INT.",
]);

export type FlowCategory = "plus" | "minus" | "neutro";

function normalizeType(operationType: string): string {
  return operationType.toUpperCase().trim();
}

export function classifyFlow(operationType: string): FlowCategory {
  const upper = normalizeType(operationType);
  if (PLUS_TYPES.has(upper)) return "plus";
  if (MINUS_TYPES.has(upper)) return "minus";
  return "neutro";
}

export function isPlus(operationType: string): boolean {
  return PLUS_TYPES.has(normalizeType(operationType));
}

export function isMinus(operationType: string): boolean {
  return MINUS_TYPES.has(normalizeType(operationType));
}

/**
 * Calcula el flujo (con signo) en EUR para una operacion.
 * - PLUS: usa eur_amount (CONTRAVALOR EFECTIVO NETO).
 * - MINUS: usa gross_amount * fx_rate (EFECTIVO BRUTO en EUR).
 * - NEUTRO: 0.
 *
 * Devuelve un valor positivo para PLUS, negativo para MINUS, 0 para NEUTRO.
 */
export function flowAmountEur(op: {
  operation_type: string | null;
  eur_amount: number | null;
  gross_amount: number | null;
  fx_rate: number | null;
}): number {
  const type = op.operation_type ?? "";
  const cat = classifyFlow(type);

  if (cat === "plus") {
    return Math.abs(op.eur_amount ?? 0);
  }

  if (cat === "minus") {
    const gross = Math.abs(op.gross_amount ?? 0);
    const fx = op.fx_rate ?? 1;
    // Si no hay gross_amount disponible, fallback a eur_amount.
    const eur = gross > 0 ? gross * fx : Math.abs(op.eur_amount ?? 0);
    return -eur;
  }

  return 0;
}
