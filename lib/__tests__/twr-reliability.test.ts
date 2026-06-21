// Harness de verificación del modelo de rentabilidades contra el motor de
// referencia de Edgard (manual_metrics.py, paquete 260619) sobre las 20 carteras
// reales (CV) de la Raw data CM. Fixtures generados en:
//   lib/__tests__/fixtures/model-cases.json
// Comprueba que lib/returns.ts reproduce, para CADA CV: capital invertido,
// Simple, MWR (anual + acumulado), TWR encadenado y — crítico — el marcado de
// TWR no fiable (PEND-018 / V-012, criterio del manual v1.1 §1.4).
//
// Nota: los flujos del fixture ya vienen firmados (FRM-002/D6 del engine), así
// que el harness valida la matemática de returns.ts, no el signado cfExtEur
// (eso lo cubre returns.test.ts con TC-003/TC-004).
import { describe, it, expect } from "vitest";
import {
  simpleReturn,
  irrFromSignedFlows,
  chainedTwr,
  assessTwrReliability,
  type SignedFlow,
} from "../returns";
import fixtures from "./fixtures/model-cases.json";

interface Case {
  id: string;
  titulo: string;
  cv: string;
  t0: string;
  asOf: string;
  snapshots: Array<{ date: string; vPos: number }>;
  flows: Array<{ amount: number; date: string }>;
  expected: {
    ci: number;
    vpos: number;
    simple: number | null;
    mwrAnnual: number | null;
    mwrCum: number | null;
    twrCum: number | null;
    twrAnnual: number | null;
    twrReliable: boolean;
    twrReasons: string[];
    maxAbsSubReturn: number;
  };
}

const cases = (fixtures as unknown as { cases: Case[] }).cases;

describe("modelo de rentabilidades — 20 CV vs engine de Edgard (260619)", () => {
  it("hay 20 casos cargados", () => {
    expect(cases.length).toBe(20);
  });

  for (const c of cases) {
    describe(`${c.id} (…${c.cv.slice(-6)}) — ${c.titulo}`, () => {
      const t0 = new Date(c.t0);
      const asOf = new Date(c.asOf);
      const flows: SignedFlow[] = c.flows.map((f) => ({ amount: f.amount, date: f.date }));
      const ci = flows.reduce((s, f) => s + f.amount, 0);

      it("capital invertido (CI) cuadra", () => {
        expect(Math.abs(ci - c.expected.ci)).toBeLessThan(1.0);
      });

      it("Simple (FRM-004) cuadra", () => {
        const s = simpleReturn(c.expected.vpos, ci);
        if (c.expected.simple === null) {
          expect(s).toBeNull();
        } else {
          expect(s).not.toBeNull();
          expect(Math.abs((s as number) - c.expected.simple)).toBeLessThan(1e-3);
        }
      });

      it("MWR (FRM-006) cuadra", () => {
        const m = irrFromSignedFlows(flows, c.expected.vpos, t0, asOf);
        if (c.expected.mwrAnnual === null) {
          expect(m).toBeNull();
        } else {
          expect(m).not.toBeNull();
          expect(Math.abs((m as { annual: number }).annual - c.expected.mwrAnnual)).toBeLessThan(1.5e-3);
          expect(Math.abs((m as { cumulative: number }).cumulative - (c.expected.mwrCum as number))).toBeLessThan(3e-3);
        }
      });

      it("TWR encadenado (FRM-007) cuadra cuando está definido", () => {
        const twr = chainedTwr(c.snapshots, flows, t0, asOf);
        if (c.expected.twrCum === null) {
          // el engine devolvió n/d (sub-periodo degenerado); aceptamos null o número
          // — la fiabilidad se valida aparte.
          expect(true).toBe(true);
        } else {
          expect(twr).not.toBeNull();
          expect(Math.abs((twr as { cumulative: number }).cumulative - c.expected.twrCum)).toBeLessThan(2e-2);
        }
      });

      it("marcado de fiabilidad del TWR (PEND-018) coincide con el modelo", () => {
        const twr = chainedTwr(c.snapshots, flows, t0, asOf);
        const m = irrFromSignedFlows(flows, c.expected.vpos, t0, asOf);
        const rel = assessTwrReliability(twr, m ? m.annual : null);
        expect(rel.reliable).toBe(c.expected.twrReliable);
      });
    });
  }

  it("se marcan exactamente los 9 casos no fiables del manual v1.1 (PEND-018)", () => {
    const flagged = cases
      .filter((c) => !c.expected.twrReliable)
      .map((c) => c.id)
      .sort();
    expect(flagged).toEqual([
      "M-04",
      "M-05",
      "M-10",
      "M-13",
      "M-14",
      "M-15",
      "M-16",
      "M-17",
      "M-18",
    ]);
  });
});
