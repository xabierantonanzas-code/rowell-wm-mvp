/**
 * Tipos del X-Ray de cartera (MVP7 Fase F2+).
 * Contrato entre la agregación (`lib/xray-aggregation.ts`) y el componente
 * `XRayTab`. Ver docs/specs/XRAY_SPEC.md.
 */

// Fila del Universo tal como llega de Supabase (`funds_universe`).
// Las columnas core están tipadas; el resto de los 136 campos viven en `data`.
export interface FundUniverseRow {
  isin: string;
  nombre: string | null;
  asset_type: string | null;
  status: string | null;
  xray_disponible: boolean | null;
  xray_nota: string | null;
  data: Record<string, unknown>;
}

// Posición de entrada para la agregación (ya clasificada IIC/RV por el caller).
export interface XRayPosition {
  isin: string;
  value: number; // position_value en EUR
  tipo: "IIC" | "RV";
  nombre?: string | null;
}

// ---- Salida de la agregación ----

export interface XRayAviso {
  isin: string;
  nombre: string;
  motivo: string;
}

export interface XRayCobertura {
  pct: number; // % del valor de cartera cubierto por el X-Ray
  avisos: XRayAviso[];
}

export interface XRayFundRow {
  isin: string;
  nombre: string;
  pesoPct: number;
  rent3yAnual: number | null;
  rent5yAnual: number | null;
  rent10yAnual: number | null;
  vol: number | null;
}

export interface XRayDistribucion {
  categoria: "Acciones" | "Obligaciones" | "Efectivo" | "Otro" | "No clasificado";
  patrimonio: number; // % sobre patrimonio
}

export interface XRayRegionRow {
  nombre: string;
  pct: number;
}

export interface XRaySectorRow {
  nombre: string;
  pct: number;
}

export interface XRayHoldingRow {
  pctActivos: number;
  nombre: string;
  // Clasificación por holding. `tipo` se deriva ya (topE=Acción / topB=Obligación).
  // `sector`/`pais` se leen del Universo si existen (topX{k}_sector / _country);
  // null mientras el Funds Pipeline no los publique → la UI muestra "—" y se
  // rellenan solos cuando el dato aparezca.
  tipo: string | null;
  sector: string | null;
  pais: string | null;
}

export interface XRayAggregation {
  cobertura: XRayCobertura;
  fondos: XRayFundRow[];          // top fondos IIC por peso
  distribucion: XRayDistribucion[];
  regiones: XRayRegionRow[];
  sectores: XRaySectorRow[];
  topHoldings: XRayHoldingRow[];
  vacio: boolean;                // true si no hay posiciones IIC analizables
}

// ---- Rentabilidad histórica (R29-1 / R29-2, "2ª página" del X-Ray) ----
//
// El pipeline Python persiste en el JSONB `data` de funds_universe:
//   - rent_YYYY     → rentabilidad del AÑO NATURAL (10 últimos años, rolling)
//   - rent_YTD, rent_1Y, rent_3Y_anual, rent_5Y_anual, rent_10Y_anual → trailing
// Todos en convención del pipeline (porcentaje, p. ej. 30.12 = 30,12 %). El
// dashboard los renderiza tal cual, SIN transformar (igual que rent_3Y_anual en
// la tabla de fondos del X-Ray). Si la escala cambiase, se ajusta en un solo
// sitio: el formateo del componente.

export interface FundYearReturn {
  isin: string;
  nombre: string;
  pesoPct: number;                       // peso del fondo sobre el invertido
  porAnyo: Record<number, number | null>; // año natural → rentabilidad %
  rentYTD: number | null;
  rent1Y: number | null;
  rent3Yanual: number | null;
  rent5Yanual: number | null;
  rent10Yanual: number | null;
}

export interface HistoricalReturnsAggregation {
  years: number[];                       // años con ≥1 fondo con dato, asc
  fondos: FundYearReturn[];              // por fondo, ordenado por peso desc
  // "Cartera teórica": qué habría rentado tu ASIGNACIÓN ACTUAL cada año
  // natural (ponderada y renormalizada al subconjunto con dato ese año).
  // Aproximación — la composición real de años pasados pudo ser distinta.
  carteraPorAnyo: Record<number, number | null>;
  coberturaPorAnyo: Record<number, number>; // % del invertido con dato, por año
  cobertura: XRayCobertura;             // cobertura global + avisos
  vacio: boolean;                        // true si ningún fondo aporta histórico
}
