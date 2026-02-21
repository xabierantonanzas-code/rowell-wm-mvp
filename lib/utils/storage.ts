import type { Position, Operation, Liquidity, ParseStats } from "@/lib/types/excel";

// ===========================================================================
// Tipos para datos almacenados en localStorage
// ===========================================================================

export interface UploadedData {
  positions: SerializedPosition[];
  operations: SerializedOperation[];
  liquidity: SerializedLiquidity[];
  stats: {
    positions: ParseStats;
    operations: ParseStats;
    liquidity: ParseStats;
  };
  uploadedAt: string;
}

/**
 * Versiones serializables de los tipos (Date → string ISO).
 * localStorage no soporta Date nativamente.
 */
export interface SerializedPosition {
  date: string;
  isin: string;
  productName: string;
  shares: number;
  avgCost: number;
  marketPrice: number;
  totalValue: number;
}

export interface SerializedOperation {
  date: string;
  type: "Compra" | "Venta" | "Aportacion" | "Reembolso";
  isin: string;
  name: string;
  amount: number;
  shares: number;
}

export interface SerializedLiquidity {
  date: string;
  type: string;
  amount: number;
  balance: number;
}

// ===========================================================================
// Clave de localStorage
// ===========================================================================

const STORAGE_KEY = "rowell_uploaded_data";

// ===========================================================================
// Funciones publicas
// ===========================================================================

/**
 * Serializa los datos parseados (convirtiendo Dates a ISO strings)
 * y los guarda en localStorage.
 */
export function setUploadedData(data: {
  positions: Position[];
  operations: Operation[];
  liquidity: Liquidity[];
  stats: {
    positions: ParseStats;
    operations: ParseStats;
    liquidity: ParseStats;
  };
}): void {
  const serialized: UploadedData = {
    positions: data.positions.map((p) => ({
      ...p,
      date: p.date.toISOString(),
    })),
    operations: data.operations.map((o) => ({
      ...o,
      date: o.date.toISOString(),
    })),
    liquidity: data.liquidity.map((l) => ({
      ...l,
      date: l.date.toISOString(),
    })),
    stats: data.stats,
    uploadedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (err) {
    console.error("Error guardando datos en localStorage:", err);
    throw new Error("No se pudieron guardar los datos. Posible falta de espacio.");
  }
}

/**
 * Recupera los datos parseados desde localStorage.
 * Retorna null si no hay datos guardados o si el JSON es invalido.
 */
export function getUploadedData(): UploadedData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: UploadedData = JSON.parse(raw);

    // Validacion basica de estructura
    if (
      !parsed.positions ||
      !parsed.operations ||
      !parsed.liquidity ||
      !parsed.stats
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Elimina los datos parseados de localStorage.
 */
export function clearUploadedData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently ignore - localStorage might not be available
  }
}
