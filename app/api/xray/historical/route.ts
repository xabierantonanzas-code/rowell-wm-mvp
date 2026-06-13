/**
 * POST /api/xray/historical
 * Rentabilidad histórica por año natural de una cartera (R29-1 / R29-2).
 *
 * Recibe las posiciones (isin, value, name), las clasifica IIC/RV, consulta
 * `funds_universe` (cliente server con ANON key → respeta RLS) y devuelve un
 * HistoricalReturnsAggregation con la matriz fondo × año + la cartera teórica.
 * Carga lazy: el componente lo llama al expandir la sub-sección histórica.
 *
 * Seguridad: requiere usuario autenticado. Solo expone datos del Universo
 * (referencia, sin PII). NUNCA usa service_role. Mismo patrón que /api/xray.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyProduct } from "@/lib/product-type";
import { getFundsByIsins } from "@/lib/queries/funds";
import { buildHistoricalReturns } from "@/lib/historical-returns";
import type { XRayPosition } from "@/lib/types/xray";

const MAX_POSITIONS = 500;

interface RawPosition {
  isin?: unknown;
  value?: unknown;
  name?: unknown;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { positions?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const raw = Array.isArray(body.positions)
    ? (body.positions as RawPosition[]).slice(0, MAX_POSITIONS)
    : [];

  const positions: XRayPosition[] = raw
    .filter((p) => p && typeof p.isin === "string" && p.isin.trim() !== "")
    .map((p) => {
      const isin = String(p.isin);
      const name = typeof p.name === "string" ? p.name : null;
      return {
        isin,
        value: Number(p.value) || 0,
        nombre: name,
        tipo: classifyProduct(isin, name) === "rv" ? "RV" : "IIC",
      };
    });

  const fundsByIsin = await getFundsByIsins(positions.map((p) => p.isin));
  const agg = buildHistoricalReturns(positions, fundsByIsin);

  return NextResponse.json(agg);
}
