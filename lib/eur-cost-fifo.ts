// ===========================================================================
// FIFO de coste en EUR por ISIN, calculado a partir del Registro de Operaciones
// ===========================================================================
//
// Por que existe esto:
// El "coste medio" (POS_11 / avg_cost) que Mapfre expone en posiciones esta
// en la divisa original del activo (USD, CHF, EUR...). Multiplicarlo por el
// fx_rate ACTUAL no refleja el efecto divisa real porque deberia usarse el
// fx_rate del MOMENTO DE COMPRA (Edgard, punto 8).
//
// Solucion: reconstruir el coste de las posiciones actuales con FIFO sobre
// las operaciones (PLUS = compras, MINUS = ventas). Para cada compra el
// "CONTRAVALOR EFECTIVO NETO" (eur_amount) ya esta en EUR al fx del momento,
// asi que sumando los lotes que aun quedan tenemos el coste EUR real.
//
// Limitaciones conocidas:
// - Splits y operaciones corporativas (NEUTRO) no ajustan unidades aqui. Si
//   un split inflo las unidades, el FIFO subestimara el coste por unidad.
//   Caso raro en la cartera Rowell por ahora.
// - Si las unidades en positions no cuadran con compras-ventas (dividendos
//   reinvertidos, ajustes), aplicamos el coste medio FIFO a las unidades
//   actuales (proporcional).

import type { Operation } from "@/lib/types/database";
import { isPlus, isMinus } from "@/lib/operations-taxonomy";

export interface EurCostInfo {
  /** Unidades restantes segun FIFO (compras - ventas). */
  unitsRemainingFifo: number;
  /** Coste total en EUR de las unidades restantes (suma de lotes). */
  eurCostRemaining: number;
  /** Coste por unidad en EUR segun FIFO (eurCostRemaining / unitsRemainingFifo). */
  eurCostPerUnit: number;
}

interface Lot {
  units: number;
  eurCostPerUnit: number;
}

/**
 * Recorre todas las operaciones de una cuenta (o conjunto) y produce un
 * Map<isin, EurCostInfo> con el coste real en EUR de cada ISIN segun FIFO.
 *
 * Las operaciones DEBEN venir ordenadas cronologicamente (asc por fecha),
 * o esta funcion las ordena.
 */
export function computeEurCostByIsin(
  operations: Operation[]
): Map<string, EurCostInfo> {
  const sorted = [...operations].sort((a, b) =>
    (a.operation_date ?? "").localeCompare(b.operation_date ?? "")
  );

  // Cola FIFO de lotes por ISIN
  const lotsByIsin = new Map<string, Lot[]>();

  for (const op of sorted) {
    const isin = op.isin?.trim();
    if (!isin) continue;

    const opType = op.operation_type ?? "";
    const units = Math.abs(op.units ?? 0);
    if (units === 0) continue;

    if (isPlus(opType)) {
      // Compra / suscripcion / aportacion: nuevo lote.
      // CONTRAVALOR EFECTIVO NETO (eur_amount) es lo que el cliente puso
      // en EUR para adquirir esas units (incluye comision si la hubo en RV).
      const eurTotal = Math.abs(op.eur_amount ?? 0);
      if (eurTotal === 0) continue;

      const lots = lotsByIsin.get(isin) ?? [];
      lots.push({ units, eurCostPerUnit: eurTotal / units });
      lotsByIsin.set(isin, lots);
    } else if (isMinus(opType)) {
      // Venta / reembolso: consumir FIFO.
      const lots = lotsByIsin.get(isin);
      if (!lots || lots.length === 0) continue;

      let toConsume = units;
      while (toConsume > 0 && lots.length > 0) {
        const lot = lots[0];
        if (lot.units <= toConsume + 1e-9) {
          toConsume -= lot.units;
          lots.shift();
        } else {
          lot.units -= toConsume;
          toConsume = 0;
        }
      }
      if (lots.length === 0) lotsByIsin.delete(isin);
      else lotsByIsin.set(isin, lots);
    }
    // NEUTRO: ignorar (splits, fusiones, traspasos internos).
  }

  // Reducir lotes restantes a info por ISIN
  const result = new Map<string, EurCostInfo>();
  for (const [isin, lots] of lotsByIsin.entries()) {
    let unitsRemaining = 0;
    let eurCost = 0;
    for (const lot of lots) {
      unitsRemaining += lot.units;
      eurCost += lot.units * lot.eurCostPerUnit;
    }
    if (unitsRemaining > 0) {
      result.set(isin, {
        unitsRemainingFifo: unitsRemaining,
        eurCostRemaining: eurCost,
        eurCostPerUnit: eurCost / unitsRemaining,
      });
    }
  }

  return result;
}

/**
 * Devuelve el coste en EUR estimado para una posicion concreta, dado el
 * map producido por computeEurCostByIsin. Si las unidades en positions no
 * cuadran exactamente con las del FIFO (caso de dividendos reinvertidos,
 * splits no contabilizados...), escala proporcional al coste por unidad.
 *
 * Si no hay info FIFO para ese ISIN devuelve null.
 */
export function eurCostForPosition(
  isin: string | null | undefined,
  unitsActual: number | null | undefined,
  costMap: Map<string, EurCostInfo>
): number | null {
  if (!isin) return null;
  const info = costMap.get(isin.trim());
  if (!info) return null;
  const u = unitsActual ?? 0;
  if (u <= 0) return 0;
  // Escalado proporcional usando el coste por unidad FIFO.
  return u * info.eurCostPerUnit;
}
