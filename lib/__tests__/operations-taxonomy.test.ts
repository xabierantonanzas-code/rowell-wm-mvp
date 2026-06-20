import { describe, it, expect } from "vitest";
import {
  classifyFlow,
  flowAmountEur,
  PLUS_TYPES,
  MINUS_TYPES,
  NEUTRO_TYPES,
} from "../operations-taxonomy";

describe("classifyFlow", () => {
  it("classifies all 6 PLUS types", () => {
    Array.from(PLUS_TYPES).forEach((t) => {
      expect(classifyFlow(t)).toBe("plus");
    });
  });

  it("classifies all 6 MINUS types", () => {
    Array.from(MINUS_TYPES).forEach((t) => {
      expect(classifyFlow(t)).toBe("minus");
    });
  });

  it("classifies all 13 NEUTRO types", () => {
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

  it("has exactly 25 explicitly listed types (6+6+13)", () => {
    expect(PLUS_TYPES.size).toBe(6);
    expect(MINUS_TYPES.size).toBe(6);
    expect(NEUTRO_TYPES.size).toBe(13);
  });

  it("clasifica los 3 tipos nuevos PEND-017 (Edgard 2026-06-15)", () => {
    expect(classifyFlow("RECEPCION IIC LIBRE PAGO")).toBe("plus");
    expect(classifyFlow("SUSCRIPCION FUSION CON IMPACTO FISCAL")).toBe("neutro");
    expect(classifyFlow("REEMBOLSO FUSION CON IMPACTO FISCAL")).toBe("neutro");
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
