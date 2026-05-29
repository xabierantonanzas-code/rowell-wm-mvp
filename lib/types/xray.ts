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
