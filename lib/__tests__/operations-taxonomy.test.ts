import { describe, it, expect } from "vitest";
import {
  classifyFlow,
  flowAmountEur,
  PLUS_TYPES,
  MINUS_TYPES,
  NEUTRO_TYPES,
} from "../operations-taxonomy";

describe("classifyFlow", () => {
  it("classifies all 5 PLUS types", () => {
    Array.from(PLUS_TYPES).forEach((t) => {
      expect(classifyFlow(t)).toBe("plus");
    });
  });

  it("classifies all 6 MINUS types", () => {
    Array.from(MINUS_TYPES).forEach((t) => {
      expect(classifyFlow(t)).toBe("minus");
    });
  });

  it("classifies all 11 NEUTRO types", () => {
    Array.from(NEUTRO_TYPES).forEach((t) => {
      expect(classifyFlow(t)).toBe("neutro");
    });
  });

  it("defaults unknown types to neutro", () => {
    expect(classifyFlow("ALGO RARO")).toBe("neutro");
    expect(classifyFlow("")).toBe("neutro");
  });

  it("is case-insensitive", () => {
    expect(classifyFlow("compra rv contado")).toBe("plus");
    expect(classifyFlow("Venta RV Contado")).toBe("minus");
  });

  it("has exactly 22 explicitly listed types (5+6+11)", () => {
    expect(PLUS_TYPES.size).toBe(5);
    expect(MINUS_TYPES.size).toBe(6);
    expect(NEUTRO_TYPES.size).toBe(11);
  });
});

describe("flowAmountEur", () => {
  it("PLUS returns positive eur_amount", () => {
    const result = flowAmountEur({
      operation_type: "SUSCRIPCIÓN FONDOS INVERSIÓN",
      eur_amount: 10000,
      gross_amount: null,
      fx_rate: null,
    });
    expect(result).toBe(10000);
  });

  it("MINUS returns negative gross_amount * fx_rate", () => {
    const result = flowAmountEur({
      operation_type: "VENTA RV CONTADO",
      eur_amount: 9500, // net (should NOT be used)
      gross_amount: 10000,
      fx_rate: 0.92,
    });
    expect(result).toBeCloseTo(-9200);
  });

  it("MINUS falls back to eur_amount if no gross_amount", () => {
    const result = flowAmountEur({
      operation_type: "LIQUIDACION IICS",
      eur_amount: 5000,
      gross_amount: 0,
      fx_rate: 1,
    });
    expect(result).toBe(-5000);
  });

  it("NEUTRO returns 0", () => {
    const result = flowAmountEur({
      operation_type: "ALTA DE NUEVO VALOR POR SPLIT",
      eur_amount: 99999,
      gross_amount: 99999,
      fx_rate: 1,
    });
    expect(result).toBe(0);
  });
});
