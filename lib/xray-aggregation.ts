/**
 * Agregación look-through del X-Ray de cartera (MVP7).
 *
 * Función PURA: posiciones (ya clasificadas IIC/RV) + saldo + filas del
 * Universo → XRayAggregation. Sin I/O, testeable. Ver docs/specs/XRAY_SPEC.md
 * (secciones 2 y 3).
 *
 * Estrategia: se acumula todo en EUR y se normaliza al final, para evitar los
 * problemas de mezclar pesos sobre-invertido vs sobre-patrimonio.
 */

import type {
  FundUniverseRow,
  XRayPosition,
  XRayAggregation,
  XRayAviso,
  XRayFundRow,
  XRayHoldingRow,
} from "@/lib/types/xray";

function num(data: Record<string, unknown>, key: string): number | null {
  const v = data[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

const REGION_MAP: Array<[string, string]> = [
  ["reg_NorthAmerica", "Estados Unidos / Canadá"],
  ["reg_UK", "Reino Unido"],
  ["reg_EuropeDeveloped", "Europa Occidental"],
  ["reg_EuropeEmerging", "Europa Emergente"],
  ["reg_AfricaMiddleEast", "Oriente Medio / África"],
  ["reg_Japan", "Japón"],
  ["reg_Australasia", "Australasia"],
  ["reg_AsiaDeveloped", "Asia Desarrollada"],
  ["reg_AsiaEmerging", "Asia Emergente"],
  ["reg_LatinAmerica", "América Latina"],
];

const SECTOR_MAP: Array<[string, string]> = [
  ["sec_BasicMaterials", "Materiales Básicos"],
  ["sec_ConsumerCyclical", "Consumo Cíclico"],
  ["sec_FinancialServices", "Servicios Financieros"],
  ["sec_RealEstate", "Inmobiliario"],
  ["sec_CommunicationServices", "Servicios de Comunicación"],
  ["sec_Energy", "Energía"],
  ["sec_Industrials", "Industria"],
  ["sec_Technology", "Tecnología"],
  ["sec_ConsumerDefensive", "Consumo Defensivo"],
  ["sec_Healthcare", "Salud"],
  ["sec_Utilities", "Servicios Públicos"],
];

export function buildXRayAggregation(
  positions: XRayPosition[],
  cashBalance: number,
  fundsByIsin: Map<string, FundUniverseRow>
): XRayAggregation {
  const iic = positions.filter((p) => p.tipo === "IIC" && p.value > 0);
  const rv = positions.filter((p) => p.tipo === "RV" && p.value > 0);

  const investedTotal = positions.reduce((s, p) => s + (p.value || 0), 0);
  const patrimonioTotal = investedTotal + (cashBalance || 0);

  // Buckets de distribución (EUR)
  let eqEur = 0, fiEur = 0, cashEur = cashBalance || 0, otherEur = 0, noClasifEur = 0;
  // Sectores / regiones (EUR sobre la parte de equity)
  const sectorEur = new Map<string, number>();
  const regionEur = new Map<string, number>();
  // Holdings look-through (EUR por nombre)
  const holdingEur = new Map<string, number>();

  const avisos: XRayAviso[] = [];
  let cubiertoEur = 0;
  const fondos: XRayFundRow[] = [];

  for (const p of iic) {
    const fund = fundsByIsin.get(p.isin);
    const disponible = !!fund && fund.xray_disponible !== false;

    if (!fund) {
      noClasifEur += p.value;
      avisos.push({
        isin: p.isin,
        nombre: p.nombre || p.isin,
        motivo: "No encontrado en el Universo de fondos",
      });
      continue;
    }

    const d = fund.data || {};

    // Tabla de fondos (2.1)
    fondos.push({
      isin: p.isin,
      nombre: fund.nombre || p.nombre || p.isin,
      pesoPct: investedTotal > 0 ? (p.value / investedTotal) * 100 : 0,
      rent3yAnual: num(d, "rent_3Y_anual"),
      vol: num(d, "vol_3Y"),
    });

    if (!disponible) {
      noClasifEur += p.value;
      avisos.push({
        isin: p.isin,
        nombre: fund.nombre || p.isin,
        motivo: fund.xray_nota || "Datos no disponibles para X-Ray",
      });
      continue;
    }

    // Aviso informativo si es aproximación (no excluye — R21-11/13)
    if (String(d["ISIN_es_aproximacion"] || "").toUpperCase() === "SI") {
      avisos.push({
        isin: p.isin,
        nombre: fund.nombre || p.isin,
        motivo: fund.xray_nota || "Datos aproximados de otra clase del mismo fondo",
      });
    }

    cubiertoEur += p.value;

    // Distribución de activos (2.2) — pct_* son % del fondo
    const pEq = num(d, "pct_Equity") ?? 0;
    const pFi = num(d, "pct_FixedIncome") ?? 0;
    const pCash = num(d, "pct_Cash") ?? 0;
    const pOther =
      (num(d, "pct_Other") ?? 0) +
      (num(d, "pct_Preferred") ?? 0) +
      (num(d, "pct_Convertible") ?? 0);

    const eqContribEur = p.value * (pEq / 100);
    eqEur += eqContribEur;
    fiEur += p.value * (pFi / 100);
    cashEur += p.value * (pCash / 100);
    otherEur += p.value * (pOther / 100);

    // Sectores y regiones (2.4/2.5) — ponderados por la parte de equity del fondo
    for (const [col, nombre] of SECTOR_MAP) {
      const w = num(d, col);
      if (w != null) {
        sectorEur.set(nombre, (sectorEur.get(nombre) || 0) + eqContribEur * (w / 100));
      }
    }
    for (const [col, nombre] of REGION_MAP) {
      const w = num(d, col);
      if (w != null) {
        regionEur.set(nombre, (regionEur.get(nombre) || 0) + eqContribEur * (w / 100));
      }
    }

    // Holdings look-through (2.6/3.4): topE + topB, ponderado por peso del fondo
    for (const prefix of ["topE", "topB"]) {
      for (let k = 1; k <= 10; k++) {
        const name = d[`${prefix}${k}_name`];
        const pct = num(d, `${prefix}${k}_pct`);
        if (typeof name === "string" && name.trim() !== "" && pct != null) {
          const eur = p.value * (pct / 100);
          holdingEur.set(name, (holdingEur.get(name) || 0) + eur);
        }
      }
    }
  }

  // RV directas: 100% acciones, cuentan como holding al 100% de su peso
  for (const p of rv) {
    eqEur += p.value;
    cubiertoEur += p.value;
    const nombre = p.nombre || p.isin;
    holdingEur.set(nombre, (holdingEur.get(nombre) || 0) + p.value);
    // contribuyen a "acciones" pero sin desglose sectorial/regional fiable
  }

  // ---- Normalizaciones ----
  const pct = (eur: number, base: number) => (base > 0 ? (eur / base) * 100 : 0);

  const distribucion: XRayAggregation["distribucion"] = [
    { categoria: "Acciones", patrimonio: pct(eqEur, patrimonioTotal) },
    { categoria: "Obligaciones", patrimonio: pct(fiEur, patrimonioTotal) },
    { categoria: "Efectivo", patrimonio: pct(cashEur, patrimonioTotal) },
    { categoria: "Otro", patrimonio: pct(otherEur, patrimonioTotal) },
    { categoria: "No clasificado", patrimonio: pct(noClasifEur, patrimonioTotal) },
  ];

  const totalEquityEur = Array.from(sectorEur.values()).reduce((s, v) => s + v, 0);
  const sectores = SECTOR_MAP.map(([, nombre]) => ({
    nombre,
    pct: pct(sectorEur.get(nombre) || 0, totalEquityEur),
  })).filter((s) => s.pct > 0).sort((a, b) => b.pct - a.pct);

  const totalRegionEur = Array.from(regionEur.values()).reduce((s, v) => s + v, 0);
  const regiones = REGION_MAP.map(([, nombre]) => ({
    nombre,
    pct: pct(regionEur.get(nombre) || 0, totalRegionEur),
  })).filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct);

  const topHoldings: XRayHoldingRow[] = Array.from(holdingEur.entries())
    .map(([nombre, eur]) => ({ nombre, pctActivos: pct(eur, investedTotal) }))
    .sort((a, b) => b.pctActivos - a.pctActivos)
    .slice(0, 10);

  fondos.sort((a, b) => b.pesoPct - a.pesoPct);

  return {
    cobertura: {
      pct: pct(cubiertoEur, investedTotal),
      avisos,
    },
    fondos: fondos.slice(0, 10),
    distribucion,
    regiones,
    sectores,
    topHoldings,
    vacio: iic.length === 0,
  };
}
