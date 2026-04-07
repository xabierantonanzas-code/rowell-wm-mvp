// ===========================================================================
// Clasificacion IIC vs RV desde el Registro de Operaciones (Edgard MVP6 #2b)
// ===========================================================================
//
// Edgard confirmo en la reunion que "hay una variable en el registro de
// operaciones que es IIC o RV" (REG_OP_7 = PRODUCTO). Es la fuente fiable.
// Mapfre no expone product_type en el snapshot de positions, pero SI en
// cada operacion. Como una posicion en cartera necesariamente fue comprada
// por una operacion previa, podemos deducir el tipo del operation_type de
// la primera compra.
//
// Reglas (basadas en los operation_type reales del Excel de Mapfre):
//
//   RV   ← COMPRA RV CONTADO, COMPRA SICAVS, VENTA RV CONTADO
//          (SICAVs son juridicamente RV)
//   IIC  ← SUSCRIPCIÓN FONDOS INVERSIÓN, REEMBOLSO FONDO INVERSIÓN,
//          REEMBOLSO POR TRASPASO EXT., SUSC.TRASPASO EXT.,
//          REEMBOLSO POR TRASPASO INT., SUSC.TRASPASO. INT.,
//          RECEPCION INTERNA IIC LP, TRASPASO INTERNO IIC LP,
//          REEMBOLSO OBLIGATORIO IIC, LIQUIDACION IICS, ALTA IIC SWITCH,
//          SUSCRIPCION POR FUSION, REEMBOLSO POR FUSION
//   ?    ← AJUSTE PARTICIP SUSCRITAS, ALTA/BAJA POR SPLIT (fallback)
//
// Si no hay operacion para un ISIN (caso raro: posicion comprada antes
// del rango del Excel) caemos a la heuristica de lib/product-type.ts.

import type { Operation } from "@/lib/types/database";
import { classifyProduct, type ProductType } from "@/lib/product-type";

const RV_KEYWORDS = ["RV CONTADO", "SICAVS"];
const IIC_KEYWORDS = [
  "FONDOS INVERSI",
  "FONDO INVERSI",
  "TRASPASO EXT",
  "TRASPASO. INT",
  "TRASPASO INT",
  "IIC LP",
  "IIC SWITCH",
  "REEMBOLSO OBLIGATORIO IIC",
  "LIQUIDACION IICS",
  "FUSION",
];

function classifyOperationType(opType: string): ProductType | null {
  const upper = opType.toUpperCase().trim();
  for (const k of RV_KEYWORDS) if (upper.includes(k)) return "rv";
  for (const k of IIC_KEYWORDS) if (upper.includes(k)) return "iic";
  return null;
}

/**
 * Construye un Map ISIN -> ProductType a partir del registro de operaciones.
 * Prioriza la primera operacion PLUS (compra) por orden cronologico de cada
 * ISIN. Para ISINs sin operaciones identificables, no aparecen en el map.
 */
export function buildProductTypeMap(
  operations: Operation[]
): Map<string, ProductType> {
  const sorted = [...operations].sort((a, b) =>
    (a.operation_date ?? "").localeCompare(b.operation_date ?? "")
  );

  const result = new Map<string, ProductType>();
  for (const op of sorted) {
    const isin = op.isin?.trim();
    if (!isin || result.has(isin)) continue;
    const t = classifyOperationType(op.operation_type ?? "");
    if (t) result.set(isin, t);
  }
  return result;
}

/**
 * Resuelve el tipo de un producto: usa primero el map de operations
 * (fuente fiable), y si no esta disponible cae a la heuristica por ISIN
 * + nombre. Devuelve siempre un valor.
 */
export function resolveProductType(
  isin: string | null | undefined,
  productName: string | null | undefined,
  opsMap?: Map<string, ProductType>
): ProductType {
  const code = (isin ?? "").trim();
  if (code && opsMap) {
    const fromOps = opsMap.get(code);
    if (fromOps) return fromOps;
  }
  return classifyProduct(isin, productName);
}
