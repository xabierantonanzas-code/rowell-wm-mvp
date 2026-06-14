// ===========================================================================
// Modelo de rentabilidades — implementación del spec aprobado por Edgard
// (paquete Claude_outputs/, 13-14 jun 2026). Ver docs/PLAN_modelo_rentabilidades_2026-06-14.md
// ===========================================================================
//
// Funciones PURAS, sin I/O, testeables. Cada una referencia su FRM-NNN del spec
// (03_formulas.md). La clasificación PLUS/MINUS/NEUTRO se reutiliza de
// lib/operations-taxonomy.ts (fuente única de la taxonomía).
//
// ESTADO:
//   - FRM-002 (cash flow, MINUS corregido D6), FRM-003, FRM-004, FRM-005,
//     FRM-006 (MWR/IRR), FRM-012, FRM-013  →  IMPLEMENTADAS y testeadas.
//   - FRM-007 (TWR encadenado) / FRM-008 (Modified Dietz)  →  PENDIENTES:
//     Edgard tiene material adicional de TWR por enviar. No implementar hasta
//     recibirlo (ver preguntas en docs/PREGUNTAS_edgard_TWR_2026-06-14.md).
//
// NOTA: este módulo NO está cableado todavía en la UI ni sustituye a
// flowAmountEur() / migration 007. El MINUS de producción sigue usando BRUTO;
// aquí está ya el NETO+RETENCIÓN (D6). El cambio en producción (tarea A1)
// requiere validación de Edgard contra TC-003 + recarga de datos.

import { classifyFlow } from "./operations-taxonomy";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_YEAR = 365.25; // base ACT/365.25 (spec §3.0)

/** Forma mínima de una operación para el cálculo de cash flow (FRM-002). */
export interface CashFlowOp {
  operation_type: string | null;
  /** REG_OP_25 CONTRAVALOR EFECTIVO NETO (EUR). Base de PLUS. */
  eur_amount: number | null;
  /** REG_OP_23 EFECTIVO NETO (divisa origen). Base de MINUS (con retención). */
  net_amount: number | null;
  /** REG_OP_27 IMPORTE RETENCION (divisa origen). Se suma al MINUS (D6). */
  withholding: number | null;
  /** REG_OP_24 CAMBIO DE LA DIVISA. */
  fx_rate: number | null;
}

/** Operación con fecha, para series temporales (FRM-003 / FRM-006). */
export interface DatedCashFlowOp extends CashFlowOp {
  /** REG_OP_15 FECHA DE CONTRATACION ("YYYY-MM-DD" o Date). */
  operation_date: string | Date | null;
}

function toDate(d: string | Date | null): Date | null {
  if (d == null) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Años entre dos fechas, base ACT/365.25 (spec §3.0). */
export function yearsBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_PER_DAY / DAYS_PER_YEAR;
}

// ---------------------------------------------------------------------------
// FRM-002 — Cash flow externo por operación (D5, D6, D14)
// ---------------------------------------------------------------------------
//   PLUS   →  + REG_OP_25                                  (eur_amount)
//   MINUS  →  − (REG_OP_23 + REG_OP_27) × REG_OP_24        (net + retención) × fx
//   NEUTRO →  0
//
// Diferencia con flowAmountEur() de producción: el MINUS usa EFECTIVO NETO +
// RETENCIÓN (D6), no EFECTIVO BRUTO. La retención se devuelve al flujo porque
// es regulatoria y no debe penalizar la rentabilidad del cliente.
export function cfExtEur(op: CashFlowOp): number {
  const cat = classifyFlow(op.operation_type ?? "");
  if (cat === "plus") {
    return Math.abs(op.eur_amount ?? 0);
  }
  if (cat === "minus") {
    const net = Math.abs(op.net_amount ?? 0);
    const ret = Math.abs(op.withholding ?? 0);
    const fx = op.fx_rate ?? 1;
    // Fallback a eur_amount si no hay neto disponible (datos incompletos).
    const base = net > 0 ? (net + ret) * fx : Math.abs(op.eur_amount ?? 0);
    return -base;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// FRM-013 — Inception date t_0 (D4): primera FECHA DE CONTRATACION de la CV.
// Las operaciones NEUTRO sí cuentan (la 1ª op puede ser un alta sin flujo).
// ---------------------------------------------------------------------------
export function inceptionDate(ops: ReadonlyArray<{ operation_date: string | Date | null }>): Date | null {
  let min: Date | null = null;
  for (const op of ops) {
    const d = toDate(op.operation_date);
    if (d && (min === null || d < min)) min = d;
  }
  return min;
}

// ---------------------------------------------------------------------------
// FRM-003 — Capital invertido acumulado CI(t) (D26): Σ CF_ext con fecha ≤ t.
// ---------------------------------------------------------------------------
export function capitalInvertido(ops: ReadonlyArray<DatedCashFlowOp>, asOf?: Date): number {
  let sum = 0;
  for (const op of ops) {
    if (asOf) {
      const d = toDate(op.operation_date);
      if (d && d > asOf) continue;
    }
    sum += cfExtEur(op);
  }
  return sum;
}

// ---------------------------------------------------------------------------
// FRM-004 — Rentabilidad Simple: (V^pos − CI) / CI. Base = valor de
// posiciones (D27), efectivo CE fuera. CI ≤ 0 → null (no definida).
// ---------------------------------------------------------------------------
export function simpleReturn(vPos: number, ci: number): number | null {
  if (ci <= 0) return null;
  return (vPos - ci) / ci;
}

// ---------------------------------------------------------------------------
// FRM-012 — Anualización genérica: (1 + r_cum)^(1/yrs) − 1.
// yrs < minYears → null (no anualizar). (1 + r_cum) ≤ 0 → null.
// ---------------------------------------------------------------------------
export function annualize(
  rCum: number | null,
  t0: Date,
  asOf: Date,
  minYears = 1.0
): number | null {
  if (rCum === null) return null;
  const yrs = yearsBetween(t0, asOf);
  if (yrs < minYears || 1 + rCum <= 0) return null;
  return Math.pow(1 + rCum, 1 / yrs) - 1;
}

// ---------------------------------------------------------------------------
// FRM-005 — Rentabilidad Simple anualizada = FRM-012(FRM-004).
// ---------------------------------------------------------------------------
export function simpleReturnAnnualized(
  vPos: number,
  ci: number,
  t0: Date,
  asOf: Date,
  minYears = 1.0
): number | null {
  return annualize(simpleReturn(vPos, ci), t0, asOf, minYears);
}

// ---------------------------------------------------------------------------
// FRM-006 — MWR / Money-Weighted Return (TIR). La única métrica EXACTA: usa
// las fechas reales de los flujos, no le afecta el hueco de snapshots.
//
//   0 = Σ −CF_i / (1+IRR)^yrs(t0, t_i)  +  V^pos_terminal / (1+IRR)^yrs(t0, asOf)
//
// Signo desde la perspectiva del inversor: PLUS son salidas de caja (−), el
// valor terminal es un ingreso (+) — opuesto al signo de FRM-003.
// IMPORTANTE: incluir el flujo de inception (op en t_0).
//
// Resuelto por bisección robusta en (−0,9999, 10). Si no hay cambio de signo
// (CI ≤ 0 degenerado, PEND-015) → devuelve null.
// ---------------------------------------------------------------------------
export interface MwrResult {
  /** TIR anual. */
  annual: number;
  /** Rentabilidad acumulada = (1 + annual)^yrs_SI − 1. */
  cumulative: number;
}

/** Flujo externo ya firmado (convención FRM-002: PLUS +, MINUS −) con su fecha. */
export interface SignedFlow {
  amount: number;
  date: string | Date | null;
}

/**
 * Solver IRR sobre flujos firmados ya calculados. Permite al llamante elegir la
 * convención de cash flow (p. ej. la `flowAmountEur` de producción mientras A1
 * no esté validada, o `cfExtEur` del spec). `mwrIrr` es el atajo con `cfExtEur`.
 */
export function irrFromSignedFlows(
  flows: ReadonlyArray<SignedFlow>,
  vTerminal: number,
  t0: Date,
  asOf: Date
): MwrResult | null {
  const fl: Array<{ amount: number; years: number }> = [];
  for (const f of flows) {
    const d = toDate(f.date);
    if (!d || f.amount === 0) continue; // NEUTRO / sin fecha no aporta
    fl.push({ amount: f.amount, years: yearsBetween(t0, d) });
  }
  const yrsSI = yearsBetween(t0, asOf);
  if (yrsSI <= 0) return null;

  const npv = (r: number): number => {
    let v = vTerminal / Math.pow(1 + r, yrsSI);
    for (const f of fl) {
      v += -f.amount / Math.pow(1 + r, f.years);
    }
    return v;
  };

  let lo = -0.9999;
  let hi = 10.0;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (Number.isNaN(fLo) || Number.isNaN(fHi) || fLo * fHi > 0) {
    return null; // sin bracket → TIR no resoluble (degenerado, PEND-015)
  }

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-10 || (hi - lo) / 2 < 1e-12) {
      return { annual: mid, cumulative: Math.pow(1 + mid, yrsSI) - 1 };
    }
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  const irr = (lo + hi) / 2;
  return { annual: irr, cumulative: Math.pow(1 + irr, yrsSI) - 1 };
}

export function mwrIrr(
  ops: ReadonlyArray<DatedCashFlowOp>,
  vTerminal: number,
  t0: Date,
  asOf: Date
): MwrResult | null {
  const flows: SignedFlow[] = ops.map((op) => ({ amount: cfExtEur(op), date: op.operation_date }));
  return irrFromSignedFlows(flows, vTerminal, t0, asOf);
}

// ---------------------------------------------------------------------------
// FRM-007 / FRM-008 — TWR encadenado / Modified Dietz.
// PENDIENTE: Edgard tiene material adicional de TWR por enviar (gap-aware,
// liquidación diferida PEND-013, etc.). No implementar hasta recibirlo.
// Ver docs/PREGUNTAS_edgard_TWR_2026-06-14.md.
// ---------------------------------------------------------------------------
