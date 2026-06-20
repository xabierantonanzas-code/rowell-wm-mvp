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
// FRM-008 — Modified Dietz de un sub-periodo. Motor interno del TWR (D29: no se
// expone como métrica al cliente). Port fiel de metrics.py `md(...)`.
//   T = días(t_fin − t_ini);  F = Σ flujos;  cap = V_B + Σ (w_i · CF_i)
//   w_i = (T − días(t_i − t_ini)) / T
//   R = (V_E − V_B − F) / cap        (cap ≤ 0 o T ≤ 0 → null)
// Los flujos llevan el signo de FRM-002 (PLUS +, MINUS −).
// ---------------------------------------------------------------------------
export interface DatedAmount {
  amount: number;
  date: Date;
}

export function modifiedDietz(
  vB: number,
  vE: number,
  flows: ReadonlyArray<DatedAmount>,
  tIni: Date,
  tFin: Date
): number | null {
  const T = (tFin.getTime() - tIni.getTime()) / MS_PER_DAY;
  if (T <= 0) return null;
  let F = 0;
  let cap = vB;
  for (const f of flows) {
    F += f.amount;
    const w = (T - (f.date.getTime() - tIni.getTime()) / MS_PER_DAY) / T;
    cap += w * f.amount;
  }
  if (cap <= 0) return null;
  return (vE - vB - F) / cap;
}

// ---------------------------------------------------------------------------
// FRM-007 — TWR encadenado (gap-aware, ruta robusta). Port fiel de metrics.py.
//
// Encadena Modified Dietz por sub-periodo entre snapshots consecutivos de
// V^pos. Arranca en el PRIMER snapshot disponible (`twrStart`), no en t_0
// (D28/PEND-013): si hay hueco grande cerca de inception (> ~1,6 cadencias),
// `sinceInception=false` (V-010) y para el tramo completo se usa el MWR.
// Los flujos del primer sub-periodo solo se incluyen si arranca en t_0.
//
// `series`: snapshots {date, vPos} (se filtran a ≥ t_0 y se ordenan).
// `flows`:  flujos externos firmados (FRM-002) con fecha.
// Devuelve null si no hay ≥ 2 snapshots o si algún sub-periodo es indefinido
// (política de integridad: mejor "datos insuficientes" que un número falso).
// ---------------------------------------------------------------------------
export interface TwrResult {
  /** Rentabilidad TWR acumulada (encadenada). */
  cumulative: number;
  /** TWR anualizada desde twrStart (null si < 1 año). */
  annual: number | null;
  /** Fecha de arranque efectivo del TWR (primer snapshot ≥ t_0). */
  twrStart: Date;
  /** false si hubo hueco de snapshots cerca de inception (V-010). */
  sinceInception: boolean;
}

export function chainedTwr(
  series: ReadonlyArray<{ date: string | Date | null; vPos: number }>,
  flows: ReadonlyArray<SignedFlow>,
  t0: Date,
  asOf?: Date
): TwrResult | null {
  const ser = series
    .map((s) => ({ date: toDate(s.date), vPos: s.vPos }))
    .filter((s): s is { date: Date; vPos: number } => s.date !== null && s.date >= t0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (ser.length < 2) return null;

  const fl: DatedAmount[] = [];
  for (const f of flows) {
    const d = toDate(f.date);
    if (d && f.amount !== 0) fl.push({ amount: f.amount, date: d });
  }

  const first = ser[0].date;
  const GAP_DAYS = 31 * 1.6; // V-010: hueco tolerado ≈ 1,6 cadencias mensuales
  const sinceInception = (first.getTime() - t0.getTime()) / MS_PER_DAY <= GAP_DAYS;
  const twrStart = first;

  let factor = 1.0;
  for (let i = 1; i < ser.length; i++) {
    const a = ser[i - 1].date;
    const b = ser[i].date;
    const vB = ser[i - 1].vPos;
    const vE = ser[i].vPos;
    const aIsT0 = a.getTime() === t0.getTime();
    const segFlows = fl.filter((x) =>
      aIsT0 ? x.date >= a && x.date <= b : x.date > a && x.date <= b
    );
    const r = modifiedDietz(vB, vE, segFlows, a, b);
    if (r === null) return null;
    factor *= 1 + r;
  }

  const cumulative = factor - 1;
  const end = asOf ?? ser[ser.length - 1].date;
  return {
    cumulative,
    annual: annualize(cumulative, twrStart, end),
    twrStart,
    sinceInception,
  };
}

// ---------------------------------------------------------------------------
// Serie temporal de rentabilidad acumulada (Simple / MWR / TWR) por snapshot.
// Para el gráfico de evolución de rentabilidad. Devuelve % (0.10 = 10%).
//   - Simple_t = (V^pos_t − CI_t) / CI_t          (CI_t = Σ flujos ≤ t)
//   - TWR_t    = Π(1 + Dietz_subperiodo) − 1      (producto acumulado, gap-aware)
//   - MWR_t    = TIR de los flujos ≤ t + valor terminal V^pos_t
// ---------------------------------------------------------------------------
export interface ReturnsPoint {
  date: string; // YYYY-MM-DD
  simple: number | null;
  mwr: number | null;
  twr: number | null;
}

export function returnsTimeSeries(
  series: ReadonlyArray<{ date: string | Date | null; vPos: number }>,
  flows: ReadonlyArray<SignedFlow>,
  t0: Date
): ReturnsPoint[] {
  const ser = series
    .map((s) => ({ date: toDate(s.date), vPos: s.vPos }))
    .filter((s): s is { date: Date; vPos: number } => s.date !== null && s.date >= t0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (ser.length === 0) return [];

  const fl: DatedAmount[] = [];
  for (const f of flows) {
    const d = toDate(f.date);
    if (d && f.amount !== 0) fl.push({ amount: f.amount, date: d });
  }

  const out: ReturnsPoint[] = [];
  let twrFactor = 1.0;
  let twrOk = true;
  for (let i = 0; i < ser.length; i++) {
    const d = ser[i].date;
    const vPos = ser[i].vPos;

    let ci = 0;
    for (const f of fl) if (f.date <= d) ci += f.amount;
    const simple = ci > 0 ? (vPos - ci) / ci : null;

    if (i > 0 && twrOk) {
      const a = ser[i - 1].date;
      const vB = ser[i - 1].vPos;
      const aIsT0 = a.getTime() === t0.getTime();
      const segFlows = fl.filter((x) =>
        aIsT0 ? x.date >= a && x.date <= d : x.date > a && x.date <= d
      );
      const r = modifiedDietz(vB, vPos, segFlows, a, d);
      if (r === null) twrOk = false;
      else twrFactor *= 1 + r;
    }
    const twr = i === 0 ? 0 : twrOk ? twrFactor - 1 : null;

    const flowsToD = fl.filter((f) => f.date <= d).map((f) => ({ amount: f.amount, date: f.date }));
    const mwrRes = irrFromSignedFlows(flowsToD, vPos, t0, d);

    out.push({
      date: d.toISOString().slice(0, 10),
      simple,
      mwr: mwrRes ? mwrRes.cumulative : null,
      twr,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// FRM-014 — Rentabilidad por horizonte (YTD / 1A / 3A / 5A / SI). Mecánica de
// ventana D30 + Simple por periodo D31. Aproximacion (snapshots semanales).
//   - Inicio teorico por periodo -> ultimo snapshot <= teorico (sin look-ahead).
//   - Si t_0 > teorico -> la ventana ES SI (V_B = 0 en t_0).
//   - Simple_H = (V_E − V_B − F_H) / (V_B + F_H)              (D31; SI = FRM-004)
//   - MWR_H    = TIR(−V_B en inicio, flujos de la ventana, +V_E terminal)
//   - TWR_H    = chained Dietz sobre los snapshots de la ventana
//   - Anualizada solo para ventanas >= 1 año.
// ---------------------------------------------------------------------------
export type Horizon = "YTD" | "1A" | "3A" | "5A" | "SI";

export interface PeriodReturn {
  period: Horizon;
  windowStart: string | null;
  simple: number | null;
  mwr: number | null;
  twr: number | null;
  simpleAnn: number | null;
  mwrAnn: number | null;
  twrAnn: number | null;
}

function subYears(d: Date, n: number): Date {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() - n);
  return x;
}

function theoreticalStart(p: Horizon, asOf: Date, t0: Date): Date {
  switch (p) {
    case "YTD":
      return new Date(asOf.getFullYear(), 0, 1);
    case "1A":
      return subYears(asOf, 1);
    case "3A":
      return subYears(asOf, 3);
    case "5A":
      return subYears(asOf, 5);
    default:
      return t0;
  }
}

export function periodReturns(
  series: ReadonlyArray<{ date: string | Date | null; vPos: number }>,
  flows: ReadonlyArray<SignedFlow>,
  t0: Date,
  asOf?: Date
): PeriodReturn[] {
  const ser = series
    .map((s) => ({ date: toDate(s.date), vPos: s.vPos }))
    .filter((s): s is { date: Date; vPos: number } => s.date !== null && s.date >= t0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (ser.length < 2) return [];

  const end = asOf ?? ser[ser.length - 1].date;
  const vE = ser[ser.length - 1].vPos;
  const fl: DatedAmount[] = [];
  for (const f of flows) {
    const d = toDate(f.date);
    if (d && f.amount !== 0) fl.push({ amount: f.amount, date: d });
  }
  const ci = fl.reduce((s, f) => (f.date <= end ? s + f.amount : s), 0);

  const periods: Horizon[] = ["YTD", "1A", "3A", "5A", "SI"];
  const out: PeriodReturn[] = [];

  for (const p of periods) {
    let windowStart: Date;
    let vB: number;
    let isSI = false;

    if (p === "SI") {
      isSI = true;
      windowStart = t0;
      vB = 0;
    } else {
      const theo = theoreticalStart(p, end, t0);
      if (theo <= t0) {
        isSI = true;
        windowStart = t0;
        vB = 0;
      } else {
        let idx = -1;
        for (let i = 0; i < ser.length; i++) {
          if (ser[i].date <= theo) idx = i;
          else break;
        }
        if (idx < 0) {
          windowStart = ser[0].date;
          vB = ser[0].vPos;
        } else {
          windowStart = ser[idx].date;
          vB = ser[idx].vPos;
        }
      }
    }

    const winFlows = fl.filter((f) =>
      isSI ? f.date <= end : f.date > windowStart && f.date <= end
    );
    const fH = winFlows.reduce((s, f) => s + f.amount, 0);

    let simple: number | null;
    if (isSI) simple = ci > 0 ? (vE - ci) / ci : null;
    else {
      const den = vB + fH;
      simple = den > 0 ? (vE - vB - fH) / den : null;
    }

    let mwr: number | null;
    if (isSI) {
      const r = irrFromSignedFlows(
        fl.filter((f) => f.date <= end).map((f) => ({ amount: f.amount, date: f.date })),
        vE,
        t0,
        end
      );
      mwr = r ? r.cumulative : null;
    } else {
      const r = irrFromSignedFlows(
        [{ amount: vB, date: windowStart }, ...winFlows.map((f) => ({ amount: f.amount, date: f.date }))],
        vE,
        windowStart,
        end
      );
      mwr = r ? r.cumulative : null;
    }

    const twrRes = chainedTwr(
      ser.filter((s) => s.date >= windowStart),
      fl,
      windowStart,
      end
    );
    const twr = twrRes ? twrRes.cumulative : null;

    const ann = yearsBetween(windowStart, end) >= 1;
    out.push({
      period: p,
      windowStart: windowStart.toISOString().slice(0, 10),
      simple,
      mwr,
      twr,
      simpleAnn: ann ? annualize(simple, windowStart, end) : null,
      mwrAnn: ann ? annualize(mwr, windowStart, end) : null,
      twrAnn: ann ? annualize(twr, windowStart, end) : null,
    });
  }
  return out;
}
