import { describe, it, expect } from "vitest";
import { computeEurCostByIsin, eurCostForPosition } from "../eur-cost-fifo";
import type { Operation } from "@/lib/types/database";

// Helper: create a minimal Operation object for testing
function makeOp(overrides: {
  isin: string;
  operation_type: string;
  operation_date?: string;
  units?: number;
  eur_amount?: number;
  gross_amount?: number | null;
  fx_rate?: number;
}): Operation {
  return {
    id: crypto.randomUUID(),
    account_id: "test-account",
    operation_number: null,
    operation_date: overrides.operation_date ?? "2025-01-01",
    settlement_date: null,
    operation_type: overrides.operation_type,
    product_name: null,
    product_type: null,
    isin: overrides.isin,
    currency: "EUR",
    units: overrides.units ?? 0,
    price: null,
    gross_amount: overrides.gross_amount ?? null,
    commission: null,
    withholding: null,
    net_amount: null,
    fx_rate: overrides.fx_rate ?? 1,
    eur_amount: overrides.eur_amount ?? 0,
    created_at: new Date().toISOString(),
  } as Operation;
}

describe("computeEurCostByIsin", () => {
  it("(a) single buy, no sell — full lot remains", () => {
    const ops = [
      makeOp({
        isin: "LU0001",
        operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN",
        operation_date: "2024-03-01",
        units: 100,
        eur_amount: 5000,
      }),
    ];

    const result = computeEurCostByIsin(ops);

    expect(result.has("LU0001")).toBe(true);
    const info = result.get("LU0001")!;
    expect(info.unitsRemainingFifo).toBeCloseTo(100);
    expect(info.eurCostRemaining).toBeCloseTo(5000);
    expect(info.eurCostPerUnit).toBeCloseTo(50);
  });

  it("(b) multiple buys + partial sell — FIFO consumes oldest first", () => {
    const ops = [
      // Lot 1: 100 units at 50 EUR/unit
      makeOp({
        isin: "US1234",
        operation_type: "COMPRA RV CONTADO",
        operation_date: "2024-01-15",
        units: 100,
        eur_amount: 5000,
      }),
      // Lot 2: 50 units at 60 EUR/unit
      makeOp({
        isin: "US1234",
        operation_type: "COMPRA RV CONTADO",
        operation_date: "2024-06-01",
        units: 50,
        eur_amount: 3000,
      }),
      // Sell 80 units (consumes 80 from lot 1)
      makeOp({
        isin: "US1234",
        operation_type: "VENTA RV CONTADO",
        operation_date: "2024-09-01",
        units: 80,
        gross_amount: 6000,
        fx_rate: 1,
        eur_amount: 5800,
      }),
    ];

    const result = computeEurCostByIsin(ops);

    expect(result.has("US1234")).toBe(true);
    const info = result.get("US1234")!;
    // Lot 1: 100 - 80 = 20 units remaining at 50 EUR/unit
    // Lot 2: 50 units at 60 EUR/unit
    // Total: 70 units, cost = 20*50 + 50*60 = 1000 + 3000 = 4000
    expect(info.unitsRemainingFifo).toBeCloseTo(70);
    expect(info.eurCostRemaining).toBeCloseTo(4000);
    expect(info.eurCostPerUnit).toBeCloseTo(4000 / 70);
  });

  it("(c) sells consuming multiple lots — FIFO chain across lots", () => {
    const ops = [
      // Lot 1: 30 units at 100 EUR/unit
      makeOp({
        isin: "IE5678",
        operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN",
        operation_date: "2023-01-10",
        units: 30,
        eur_amount: 3000,
      }),
      // Lot 2: 40 units at 120 EUR/unit
      makeOp({
        isin: "IE5678",
        operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN",
        operation_date: "2023-06-15",
        units: 40,
        eur_amount: 4800,
      }),
      // Lot 3: 20 units at 110 EUR/unit
      makeOp({
        isin: "IE5678",
        operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN",
        operation_date: "2024-01-01",
        units: 20,
        eur_amount: 2200,
      }),
      // Sell 60 units: consumes all of lot 1 (30) + 30 from lot 2
      makeOp({
        isin: "IE5678",
        operation_type: "LIQUIDACION IICS",
        operation_date: "2024-06-01",
        units: 60,
        gross_amount: 7200,
        fx_rate: 1,
        eur_amount: 7000,
      }),
    ];

    const result = computeEurCostByIsin(ops);

    expect(result.has("IE5678")).toBe(true);
    const info = result.get("IE5678")!;
    // Lot 2: 40 - 30 = 10 units remaining at 120 EUR/unit
    // Lot 3: 20 units at 110 EUR/unit
    // Total: 30 units, cost = 10*120 + 20*110 = 1200 + 2200 = 3400
    expect(info.unitsRemainingFifo).toBeCloseTo(30);
    expect(info.eurCostRemaining).toBeCloseTo(3400);
    expect(info.eurCostPerUnit).toBeCloseTo(3400 / 30);
  });

  it("fully sold position is excluded from result", () => {
    const ops = [
      makeOp({
        isin: "US9999",
        operation_type: "COMPRA RV CONTADO",
        operation_date: "2024-01-01",
        units: 50,
        eur_amount: 2500,
      }),
      makeOp({
        isin: "US9999",
        operation_type: "VENTA RV CONTADO",
        operation_date: "2024-12-01",
        units: 50,
        gross_amount: 3000,
        fx_rate: 1,
        eur_amount: 2900,
      }),
    ];

    const result = computeEurCostByIsin(ops);
    expect(result.has("US9999")).toBe(false);
  });

  it("NEUTRO operations are ignored", () => {
    const ops = [
      makeOp({
        isin: "LU0001",
        operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN",
        operation_date: "2024-01-01",
        units: 100,
        eur_amount: 5000,
      }),
      makeOp({
        isin: "LU0001",
        operation_type: "ALTA DE NUEVO VALOR POR SPLIT",
        operation_date: "2024-06-01",
        units: 100,
        eur_amount: 0,
      }),
    ];

    const result = computeEurCostByIsin(ops);
    const info = result.get("LU0001")!;
    // Split is ignored — only the original 100 units at 50 EUR/unit
    expect(info.unitsRemainingFifo).toBeCloseTo(100);
    expect(info.eurCostRemaining).toBeCloseTo(5000);
  });

  it("internal transfers move lots between ISINs (SUSC.TRASPASO. INT. + REEMBOLSO POR TRASPASO INT.)", () => {
    const ops = [
      // Buy 100 units at 50€ in ISIN_A
      makeOp({
        isin: "ISIN_A",
        operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN",
        operation_date: "2023-01-01",
        units: 100,
        eur_amount: 5000,
      }),
      // Internal transfer OUT: all 100 units leave ISIN_A
      makeOp({
        isin: "ISIN_A",
        operation_type: "REEMBOLSO POR TRASPASO INT.",
        operation_date: "2024-06-01",
        units: 100,
        eur_amount: 5500,
      }),
      // Internal transfer IN: 120 units arrive in ISIN_B at market value 5200€
      makeOp({
        isin: "ISIN_B",
        operation_type: "SUSC.TRASPASO. INT.",
        operation_date: "2024-06-01",
        units: 120,
        eur_amount: 5200,
      }),
    ];

    const result = computeEurCostByIsin(ops);

    // ISIN_A: all lots consumed, should not be in result
    expect(result.has("ISIN_A")).toBe(false);

    // ISIN_B: 120 units with eurCostRemaining = 5200
    expect(result.has("ISIN_B")).toBe(true);
    const info = result.get("ISIN_B")!;
    expect(info.unitsRemainingFifo).toBeCloseTo(120);
    expect(info.eurCostRemaining).toBeCloseTo(5200);
  });

  it("operations are sorted chronologically regardless of input order", () => {
    const ops = [
      // Sell first in array but later by date
      makeOp({
        isin: "US1111",
        operation_type: "VENTA RV CONTADO",
        operation_date: "2024-06-01",
        units: 20,
        gross_amount: 1500,
        fx_rate: 1,
        eur_amount: 1400,
      }),
      // Buy second in array but earlier by date
      makeOp({
        isin: "US1111",
        operation_type: "COMPRA RV CONTADO",
        operation_date: "2024-01-01",
        units: 50,
        eur_amount: 2500,
      }),
    ];

    const result = computeEurCostByIsin(ops);
    const info = result.get("US1111")!;
    expect(info.unitsRemainingFifo).toBeCloseTo(30);
    expect(info.eurCostRemaining).toBeCloseTo(1500); // 30 * 50
  });
});

describe("eurCostForPosition", () => {
  it("returns null for unknown ISIN", () => {
    const map = new Map();
    expect(eurCostForPosition("XX0000", 10, map)).toBeNull();
  });

  it("scales proportionally when actual units are fewer than FIFO", () => {
    const map = new Map([
      ["LU0001", { unitsRemainingFifo: 100, eurCostRemaining: 5000, eurCostPerUnit: 50 }],
    ]);
    // Actual units = 80 (partial — fewer than FIFO tracked)
    expect(eurCostForPosition("LU0001", 80, map)).toBeCloseTo(4000);
  });

  it("caps at eurCostRemaining when actual units exceed FIFO (splits)", () => {
    const map = new Map([
      ["LU0001", { unitsRemainingFifo: 100, eurCostRemaining: 5000, eurCostPerUnit: 50 }],
    ]);
    // After 2:1 split: 200 units but capital invested was still 5000
    expect(eurCostForPosition("LU0001", 200, map)).toBeCloseTo(5000);
    // Even 10x split: still capped at 5000
    expect(eurCostForPosition("LU0001", 1000, map)).toBeCloseTo(5000);
  });
});
