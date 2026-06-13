/**
 * Rentabilidad histórica por año natural (R29-1 / R29-2) — "2ª página" del X-Ray.
 *
 * Función PURA: posiciones (ya clasificadas IIC/RV) + filas del Universo →
 * HistoricalReturnsAggregation. Sin I/O, testeable. Mismo patrón que
 * `lib/xray-aggregation.ts`.
 *
 * Lee del JSONB `data` de funds_universe los campos rent_YYYY (año natural) y
 * los trailing (rent_YTD, rent_1Y, rent_3Y_anual, rent_5Y_anual, rent_10Y_anual)
 * que produce el pipeline Python (rentabilidad_anual.py + actualiza_universo_v5.py).
 *
 * Solo las IIC tienen histórico en el Universo. Las RV directas (acciones) no
 * son fondos → no aportan rent_YYYY y se reflejan como hueco de cobertura.
 *
 * La fila "cartera teórica" pondera la rentabilidad de cada año por el peso
 * ACTUAL de cada fondo, renormalizado al subconjunto que tiene dato ese año.
 * Es una aproximación (la composición real de años pasados pudo diferir); el
 * componente lo deja claro en el disclaimer.
 */

import type {
  FundUniverseRow,
  XRayPosition,
  XRayAviso,
  FundYearReturn,
  HistoricalReturnsAggregation,
} from "@/lib/types/xray";

function num(data: Record<string, unknown>, key: string): number | null {
  const v = data[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

// 10 años naturales completos hasta el año anterior al actual (rolling), igual
// que RENT_CY_YEARS del pipeline. Se calcula al vuelo para no editar cada año.
function candidateYears(now = new Date()): number[] {
  const y = now.getFullYear();
  const out: number[] = [];
  for (let i = y - 10; i < y; i++) out.push(i);
  return out;
}

export function buildHistoricalReturns(
  positions: XRayPosition[],
  fundsByIsin: Map<string, FundUniverseRow>,
  now = new Date()
): HistoricalReturnsAggregation {
  const iic = positions.filter((p) => p.tipo === "IIC" && p.value > 0);
  const rv = positions.filter((p) => p.tipo === "RV" && p.value > 0);
  const investedTotal = positions.reduce((s, p) => s + (p.value || 0), 0);

  const allYears = candidateYears(now);
  const avisos: XRayAviso[] = [];
  const fondos: FundYearReturn[] = [];

  // Acumuladores para la cartera teórica: por año, suma(peso·rent) y suma(peso)
  const carteraNum = new Map<number, number>(); // Σ value·rent
  const carteraDen = new Map<number, number>(); // Σ value (con dato ese año)
  let cubiertoEur = 0; // valor de fondos con AL MENOS un año de histórico

  for (const p of iic) {
    const fund = fundsByIsin.get(p.isin);

    if (!fund) {
      avisos.push({
        isin: p.isin,
        nombre: p.nombre || p.isin,
        motivo: "No encontrado en el Universo de fondos",
      });
      continue;
    }

    const d = fund.data || {};
    const porAnyo: Record<number, number | null> = {};
    let tieneAlgun = false;

    for (const y of allYears) {
      const r = num(d, `rent_${y}`);
      porAnyo[y] = r;
      if (r != null) {
        tieneAlgun = true;
        carteraNum.set(y, (carteraNum.get(y) || 0) + p.value * r);
        carteraDen.set(y, (carteraDen.get(y) || 0) + p.value);
      }
    }

    fondos.push({
      isin: p.isin,
      nombre: fund.nombre || p.nombre || p.isin,
      pesoPct: investedTotal > 0 ? (p.value / investedTotal) * 100 : 0,
      porAnyo,
      rentYTD: num(d, "rent_YTD"),
      rent1Y: num(d, "rent_1Y"),
      rent3Yanual: num(d, "rent_3Y_anual"),
      rent5Yanual: num(d, "rent_5Y_anual"),
      rent10Yanual: num(d, "rent_10Y_anual"),
    });

    if (tieneAlgun) cubiertoEur += p.value;
    else {
      avisos.push({
        isin: p.isin,
        nombre: fund.nombre || p.isin,
        motivo: fund.xray_nota || "Sin rentabilidad histórica por año disponible",
      });
    }
  }

  // RV directas: no hay histórico por año en el Universo → hueco de cobertura.
  for (const p of rv) {
    avisos.push({
      isin: p.isin,
      nombre: p.nombre || p.isin,
      motivo: "Acción directa: sin rentabilidad histórica de fondo",
    });
  }

  // Años efectivos: solo los que tienen al menos un fondo con dato.
  const years = allYears.filter((y) => (carteraDen.get(y) || 0) > 0);

  const carteraPorAnyo: Record<number, number | null> = {};
  const coberturaPorAnyo: Record<number, number> = {};
  for (const y of years) {
    const den = carteraDen.get(y) || 0;
    carteraPorAnyo[y] = den > 0 ? (carteraNum.get(y) || 0) / den : null;
    coberturaPorAnyo[y] = investedTotal > 0 ? (den / investedTotal) * 100 : 0;
  }

  fondos.sort((a, b) => b.pesoPct - a.pesoPct);

  return {
    years,
    fondos,
    carteraPorAnyo,
    coberturaPorAnyo,
    cobertura: {
      pct: investedTotal > 0 ? (cubiertoEur / investedTotal) * 100 : 0,
      avisos,
    },
    vacio: years.length === 0,
  };
}
