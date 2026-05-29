/**
 * Queries del Universo de fondos (`funds_universe`) para el X-Ray.
 *
 * SEGURIDAD: usa el cliente server con la ANON key (`@/lib/supabase/server`),
 * que respeta RLS. NUNCA el cliente admin/service_role. La policy RLS de
 * `funds_universe` permite SELECT a usuarios autenticados (dato de referencia
 * sin PII). Ver rowell-funds-pipeline-python/data/migrations/funds_data_001_universe.sql.
 */

import { createClient } from "@/lib/supabase/server";
import { cached } from "@/lib/cache";
import type { FundUniverseRow } from "@/lib/types/xray";

const TTL_SECONDS = 60 * 30; // el Universo se actualiza mensualmente

/**
 * Trae las filas de `funds_universe` para un conjunto de ISINs.
 * Devuelve un Map isin -> fila para look-up O(1) en la agregación.
 * Resiliente: si la tabla aún no existe (migración no aplicada) o falla,
 * devuelve un Map vacío para que el X-Ray degrade con gracia.
 */
export async function getFundsByIsins(
  isins: string[]
): Promise<Map<string, FundUniverseRow>> {
  const unique = Array.from(new Set(isins.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const key = `funds_universe:${unique.sort().join(",")}`;
  return cached(key, TTL_SECONDS, async () => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("funds_universe")
      .select(
        "isin, nombre, asset_type, status, xray_disponible, xray_nota, data"
      )
      .in("isin", unique);

    if (error || !data) {
      // Tabla ausente (migración pendiente) o error → degradación elegante.
      return new Map<string, FundUniverseRow>();
    }

    const map = new Map<string, FundUniverseRow>();
    for (const row of data as FundUniverseRow[]) {
      if (row.isin) map.set(row.isin, row);
    }
    return map;
  });
}
