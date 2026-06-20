import { describe, it, expect } from "vitest";
import {
  cfExtEur,
  inceptionDate,
  capitalInvertido,
  simpleReturn,
  simpleReturnAnnualized,
  annualize,
  mwrIrr,
  yearsBetween,
  modifiedDietz,
  chainedTwr,
  type DatedCashFlowOp,
} from "../returns";

// Valores verificados en el spec (03_formulas.md, 06_test_cases.md).
// CV …226249 = Aurum-077. as_of = 2026-03-19.

describe("cfExtEur — FRM-002 (D6 MINUS = NETO + RETENCIÓN)", () => {
  it("PLUS usa eur_amount (CONTRAVALOR EFECTIVO NETO)", () => {
    expect(
      cfExtEur({
        operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN",
        eur_amount: 950.0,
        net_amount: null,
        withholding: null,
        fx_rate: 1,
      })
    ).toBeCloseTo(950.0, 2);
  });

  it("PLUS RV USD (TC-004 compra) = +4781,46 vía eur_amount", () => {
    expect(
      cfExtEur({
        operation_type: "COMPRA RV CONTADO",
        eur_amount: 4781.46,
        net_amount: 4970.56,
        withholding: 0,
        fx_rate: 0.961955,
      })
    ).toBeCloseTo(4781.46, 2);
  });

  it("MINUS con retención (TC-003) = −(4990,49 + 10,62) × 1,0 = −5001,11", () => {
    expect(
      cfExtEur({
        operation_type: "REEMBOLSO FONDO INVERSIÓN",
        eur_amount: -5001.11,
        net_amount: 4990.49,
        withholding: 10.62,
        fx_rate: 1.0,
      })
    ).toBeCloseTo(-5001.11, 2);
  });

  it("MINUS USD (TC-004 venta) = −(3992,00 + 0) × 0,855097 = −3413,55", () => {
    expect(
      cfExtEur({
        operation_type: "VENTA RV CONTADO",
        eur_amount: -3413.55,
        net_amount: 3992.0,
        withholding: 0,
        fx_rate: 0.855097,
      })
    ).toBeCloseTo(-3413.55, 2);
  });

  it("NEUTRO (switch interno) = 0", () => {
    expect(
      cfExtEur({
        operation_type: "SUSC.TRASPASO. INT.",
        eur_amount: 12345,
        net_amount: 12345,
        withholding: 0,
        fx_rate: 1,
      })
    ).toBe(0);
  });
});

describe("inceptionDate — FRM-013", () => {
  it("toma la primera FECHA DE CONTRATACION (CV 226249 → 2021-09-27)", () => {
    const ops = [
      { operation_date: "2022-01-10" },
      { operation_date: "2021-09-27" },
      { operation_date: "2023-05-01" },
    ];
    expect(inceptionDate(ops)?.toISOString().slice(0, 10)).toBe("2021-09-27");
  });

  it("NEUTRO también cuenta para t_0", () => {
    const ops = [
      { operation_date: "2021-09-27" },
      { operation_date: "2021-01-01" }, // alta sin flujo
    ];
    expect(inceptionDate(ops)?.toISOString().slice(0, 10)).toBe("2021-01-01");
  });
});

describe("capitalInvertido — FRM-003", () => {
  it("suma PLUS, resta MINUS, ignora NEUTRO", () => {
    const ops: DatedCashFlowOp[] = [
      { operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN", operation_date: "2024-01-01", eur_amount: 10000, net_amount: null, withholding: null, fx_rate: 1 },
      { operation_type: "REEMBOLSO FONDO INVERSIÓN", operation_date: "2024-06-01", eur_amount: -2000, net_amount: 1990, withholding: 10, fx_rate: 1 },
      { operation_type: "SUSC.TRASPASO. INT.", operation_date: "2024-07-01", eur_amount: 5000, net_amount: 5000, withholding: 0, fx_rate: 1 },
    ];
    // 10000 − (1990+10) = 8000
    expect(capitalInvertido(ops)).toBeCloseTo(8000, 2);
  });

  it("respeta el corte temporal asOf", () => {
    const ops: DatedCashFlowOp[] = [
      { operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN", operation_date: "2024-01-01", eur_amount: 10000, net_amount: null, withholding: null, fx_rate: 1 },
      { operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN", operation_date: "2025-01-01", eur_amount: 5000, net_amount: null, withholding: null, fx_rate: 1 },
    ];
    expect(capitalInvertido(ops, new Date("2024-12-31"))).toBeCloseTo(10000, 2);
  });
});

describe("simpleReturn — FRM-004 (Aurum-077 SI)", () => {
  it("(361.598,11 − 290.922,76) / 290.922,76 = 24,29 %", () => {
    const r = simpleReturn(361598.11, 290922.76);
    expect(r).not.toBeNull();
    expect((r as number) * 100).toBeCloseTo(24.29, 1);
  });

  it("CI ≤ 0 → null", () => {
    expect(simpleReturn(100, 0)).toBeNull();
    expect(simpleReturn(100, -50)).toBeNull();
  });
});

describe("annualize / simpleReturnAnnualized — FRM-012 / FRM-005", () => {
  const t0 = new Date("2021-09-27");
  const asOf = new Date("2026-03-19"); // ≈ 4,476 años

  it("yrs ≈ 4,476 entre t_0 y as_of", () => {
    expect(yearsBetween(t0, asOf)).toBeCloseTo(4.476, 2);
  });

  it("Simple anualizada Aurum ≈ 4,98 %", () => {
    const r = simpleReturnAnnualized(361598.11, 290922.76, t0, asOf);
    expect(r).not.toBeNull();
    expect((r as number) * 100).toBeCloseTo(4.98, 1);
  });

  it("horizonte < 1 año → null (no anualizar)", () => {
    expect(annualize(0.05, new Date("2026-01-01"), new Date("2026-06-01"))).toBeNull();
  });

  it("pérdida total (1 + r ≤ 0) → null", () => {
    expect(annualize(-1.5, t0, asOf)).toBeNull();
  });
});

describe("mwrIrr — FRM-006 (solver TIR)", () => {
  it("caso sintético: invertir 100, terminal 121 a ~2 años → IRR ≈ 10 %", () => {
    const t0 = new Date("2020-01-01");
    const asOf = new Date("2022-01-01"); // 731 días ≈ 2,001 años
    const ops: DatedCashFlowOp[] = [
      { operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN", operation_date: "2020-01-01", eur_amount: 100, net_amount: null, withholding: null, fx_rate: 1 },
    ];
    const res = mwrIrr(ops, 121, t0, asOf);
    expect(res).not.toBeNull();
    expect((res as { annual: number }).annual * 100).toBeCloseTo(10, 0);
  });

  it("cumulative coherente con annual: (1+IRR)^yrs − 1", () => {
    const t0 = new Date("2020-01-01");
    const asOf = new Date("2022-01-01");
    const ops: DatedCashFlowOp[] = [
      { operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN", operation_date: "2020-01-01", eur_amount: 100, net_amount: null, withholding: null, fx_rate: 1 },
    ];
    const res = mwrIrr(ops, 121, t0, asOf)!;
    const yrs = yearsBetween(t0, asOf);
    expect(res.cumulative).toBeCloseTo(Math.pow(1 + res.annual, yrs) - 1, 6);
  });

  it("flujo intermedio: dos aportaciones + terminal converge a una TIR positiva", () => {
    const t0 = new Date("2022-01-01");
    const asOf = new Date("2025-01-01");
    const ops: DatedCashFlowOp[] = [
      { operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN", operation_date: "2022-01-01", eur_amount: 1000, net_amount: null, withholding: null, fx_rate: 1 },
      { operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN", operation_date: "2023-07-01", eur_amount: 500, net_amount: null, withholding: null, fx_rate: 1 },
    ];
    const res = mwrIrr(ops, 1800, t0, asOf);
    expect(res).not.toBeNull();
    expect((res as { annual: number }).annual).toBeGreaterThan(0);
    expect((res as { annual: number }).annual).toBeLessThan(1);
  });

  it("degenerado sin cambio de signo (solo entradas, terminal > 0) → null", () => {
    // npv > 0 en todo el rango → no hay TIR resoluble (PEND-015)
    const t0 = new Date("2022-01-01");
    const asOf = new Date("2025-01-01");
    const ops: DatedCashFlowOp[] = [
      { operation_type: "REEMBOLSO FONDO INVERSIÓN", operation_date: "2022-01-01", eur_amount: -1000, net_amount: 1000, withholding: 0, fx_rate: 1 },
    ];
    // Solo un MINUS (salida del inversor = +1000 en NPV) + terminal +500 → todo positivo
    expect(mwrIrr(ops, 500, t0, asOf)).toBeNull();
  });
});

describe("modifiedDietz — FRM-008", () => {
  const a = new Date("2024-01-01");
  const b = new Date("2025-01-01"); // T = 366 días (2024 bisiesto)

  it("sin flujos: (V_E − V_B) / V_B", () => {
    expect(modifiedDietz(100, 121, [], a, b)).toBeCloseTo(0.21, 6);
  });

  it("flujo a mitad de periodo pondera el capital", () => {
    const mid = new Date("2024-07-02"); // ~día 183 de 366 → w ≈ 0.5
    // F=100, cap=100 + 0.5·100 = 150, R=(210−100−100)/150 = 0.0667
    const r = modifiedDietz(100, 210, [{ amount: 100, date: mid }], a, b);
    expect(r as number).toBeCloseTo(0.0667, 3);
  });

  it("capital ponderado ≤ 0 → null", () => {
    expect(modifiedDietz(0, 10, [{ amount: -100, date: a }], a, b)).toBeNull();
  });

  it("T ≤ 0 → null", () => {
    expect(modifiedDietz(100, 110, [], b, a)).toBeNull();
  });
});

describe("chainedTwr — FRM-007 (gap-aware)", () => {
  it("encadena sub-periodos sin flujos: 100→110→121 ⇒ 21%", () => {
    const t0 = new Date("2024-01-01");
    const series = [
      { date: "2024-01-01", vPos: 100 },
      { date: "2024-07-01", vPos: 110 },
      { date: "2025-01-01", vPos: 121 },
    ];
    const res = chainedTwr(series, [], t0);
    expect(res).not.toBeNull();
    expect((res as { cumulative: number }).cumulative).toBeCloseTo(0.21, 6);
    expect((res as { sinceInception: boolean }).sinceInception).toBe(true);
  });

  it("hueco grande cerca de inception → sinceInception=false (V-010)", () => {
    const t0 = new Date("2021-09-27");
    const series = [
      { date: "2023-01-31", vPos: 100 }, // primer snapshot 491 días después de t0
      { date: "2023-12-31", vPos: 110 },
    ];
    const res = chainedTwr(series, [], t0);
    expect(res).not.toBeNull();
    expect((res as { sinceInception: boolean }).sinceInception).toBe(false);
  });

  it("menos de 2 snapshots → null (datos insuficientes)", () => {
    expect(chainedTwr([{ date: "2024-01-01", vPos: 100 }], [], new Date("2024-01-01"))).toBeNull();
  });
});
