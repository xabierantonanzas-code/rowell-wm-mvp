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
// las operaciones. Para cada compra el "CONTRAVALOR EFECTIVO NETO"
// (eur_amount) ya esta en EUR al fx del momento.
//
// IMPORTANTE: los conjuntos FIFO_PLUS / FIFO_MINUS son DISTINTOS de los
// PLUS / MINUS de aportaciones netas (lib/operations-taxonomy.ts).
//
// - Aportaciones netas: flujo de capital entre el cliente y la cartera.
//   SUSC.TRASPASO. INT. y REEMBOLSO POR TRASPASO INT. son NEUTRO porque
//   el capital no entra ni sale del patrimonio del cliente.
//
// - FIFO por ISIN: coste EUR atribuido a cada posicion especifica.
//   Los traspasos internos SI mueven lotes entre ISINs (cambio de clase
//   de un fondo, p.ej. Comgest IE00B4ZJ4188 -> IE00B6X8T619 ->
//   IE0004766675). Por eso se incluyen en FIFO_PLUS/FIFO_MINUS.
//
// Limitacion conocida: el coste base de una posicion tras traspaso
// interno es el valor de mercado en la fecha del traspaso, no el coste
// de compra original. Para fondos EUR-native esto no tiene impacto
// material. Para fondos USD/CHF, el efecto divisa se mide desde la
// ultima fecha de traspaso.

import type { Operation } from "@/lib/types/database";

// ===========================================================================
// FIFO-specific type sets (distinct from aportaciones taxonomy)
// ===========================================================================

/** Operaciones que CREAN lotes FIFO en un ISIN. */
const FIFO_PLUS_TYPES = new Set([
  // Aportaciones reales (capital entra)
  "SUSCRIPCIÓN FONDOS INVERSIÓN",
  "COMPRA RV CONTADO",
  "COMPRA SICAVS",
  "RECEPCION INTERNA IIC LP",
  "SUSC.TRASPASO EXT.",
  // Traspasos internos: el ISIN receptor gana lotes
  "SUSC.TRASPASO. INT.",
]);

/** Operaciones que CONSUMEN lotes FIFO de un ISIN. */
const FIFO_MINUS_TYPES = new Set([
  // Reembolsos reales (capital sale)
  "VENTA RV CONTADO",
  "LIQUIDACION IICS",
  "TRASPASO INTERNO IIC LP",
  "REEMBOLSO FONDO INVERSIÓN",
  "REEMBOLSO OBLIGATORIO IIC",
  "REEMBOLSO POR TRASPASO EXT.",
  // Traspasos internos: el ISIN emisor pierde lotes
  "REEMBOLSO POR TRASPASO INT.",
]);

function isFifoPlus(opType: string): boolean {
  return FIFO_PLUS_TYPES.has(opType.toUpperCase().trim());
}

function isFifoMinus(opType: string): boolean {
  return FIFO_MINUS_TYPES.has(opType.toUpperCase().trim());
}

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

    if (isFifoPlus(opType)) {
      // Compra, suscripcion, o traspaso interno entrante: nuevo lote.
      const eurTotal = Math.abs(op.eur_amount ?? 0);
      if (eurTotal === 0) continue;

      const lots = lotsByIsin.get(isin) ?? [];
      lots.push({ units, eurCostPerUnit: eurTotal / units });
      lotsByIsin.set(isin, lots);
    } else if (isFifoMinus(opType)) {
      // Venta, reembolso, o traspaso interno saliente: consumir FIFO.
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
    // Todo lo demas (splits, fusiones, ajustes): ignorar.
  }

  // Reducir lotes restantes a info por ISIN
  const result = new Map<string, EurCostInfo>();
  for (const [isin, lots] of Array.from(lotsByIsin.entries())) {
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
 * map producido por computeEurCostByIsin.
 *
 * Cuando las unidades actuales superan las del FIFO (por splits u
 * operaciones corporativas que inflaron unidades sin aportar capital),
 * el coste se capa a eurCostRemaining — el capital real invertido.
 *
 * Cuando las unidades actuales son menores (venta parcial fuera del
 * sistema, o datos incompletos), escala proporcional.
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
  // Cap at eurCostRemaining: if actual units > FIFO units (splits),
  // the extra units don't represent additional capital invested.
  const ratio = Math.min(u / info.unitsRemainingFifo, 1);
  return ratio * info.eurCostRemaining;
}
