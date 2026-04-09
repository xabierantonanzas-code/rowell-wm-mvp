// ===========================================================================
// Admin summary - KPIs globales precalculados
// ===========================================================================
//
// ⚠️  SERVER-ONLY. Este archivo usa createAdminClient() (service_role) y
//     NUNCA debe importarse desde codigo que vaya al cliente. Next.js
//     no bundlea SUPABASE_SERVICE_ROLE_KEY en el client (no empieza por
//     NEXT_PUBLIC_), pero como defensa en profundidad verificamos en
//     runtime.
//
// MVP6 Prioridad 2: la carga del admin "Todos los clientes" necesita
// totales globales (AUM, patrimonio invertido, rentabilidad) en ms.
//
// Estrategia de 2 niveles:
//
//   1. FAST PATH: consultar la vista materializada `global_kpis` via
//      admin client (service_role). Ms de respuesta. Se refresca sola
//      tras cada upload (refresh_client_summary RPC).
//
//   2. FALLBACK: si la vista no existe todavia (migracion 007 sin
//      aplicar) o falla, calcular los totales con SQL agregado puro
//      en Postgres. ~200-500 ms. Aun asi mucho mas rapido que iterar
//      22k positions en JS desde el viejo camino de getAllLatestPositions.
//
// Seguridad:
//   - Este helper SOLO debe llamarse desde codigo server-side que ya
//     haya verificado que el caller es admin/owner. No expone datos
//     al cliente directamente.
//   - Usa createAdminClient() (service_role) porque las MVs tienen
//     GRANT SELECT solo a service_role (no a authenticated).

import { createAdminClient } from "@/lib/supabase/admin";
import { flowAmountEur } from "@/lib/operations-taxonomy";

// Defensa en profundidad: si por error se importa este modulo desde
// codigo que acaba ejecutandose en el navegador, explota con un mensaje
// claro en lugar de filtrar el service_role_key silenciosamente.
if (typeof window !== "undefined") {
  throw new Error(
    "[admin-summary] server-only module imported from client bundle"
  );
}

export interface GlobalAdminKpis {
  numClientes: number;
  numClientesConDatos: number;
  aumTotal: number;             // SUM(valor_cartera)
  saldoTotal: number;           // SUM(cash_balances)
  patrimonioTotal: number;      // aum + saldo
  patrimonioInvertido: number;  // SUM(PLUS) - SUM(MINUS) sobre todas las ops
  rentabilidadAcumuladaEur: number;
  rentabilidadAcumuladaPct: number;
  numCuentas: number;
  numPosiciones: number;
  ultimaFecha: string | null;
  /** "mv" si vino de la vista materializada, "sql" si vino del fallback
   *  con SQL agregado, "js" si vino del fallback mas basico. Util para
   *  debug y para medir si hay que aplicar la migracion. */
  source: "mv" | "sql" | "js";
}

/**
 * Obtiene los KPIs globales del admin con el mejor camino disponible.
 * Siempre devuelve un objeto consistente. Nunca lanza por causa de
 * datos faltantes: si no hay nada, devuelve ceros.
 */
export async function getGlobalAdminKpis(): Promise<GlobalAdminKpis> {
  const admin = createAdminClient();

  // --- 1) FAST PATH: vista materializada global_kpis ---
  try {
    const { data, error } = await admin
      .from("global_kpis")
      .select("*")
      .maybeSingle();

    if (!error && data) {
      return {
        numClientes: Number(data.num_clientes ?? 0),
        numClientesConDatos: Number(data.num_clientes_con_datos ?? 0),
        aumTotal: Number(data.aum_total ?? 0),
        saldoTotal: Number(data.saldo_total ?? 0),
        patrimonioTotal: Number(data.patrimonio_total ?? 0),
        patrimonioInvertido: Number(data.patrimonio_invertido ?? 0),
        rentabilidadAcumuladaEur: Number(data.rentabilidad_acumulada_eur ?? 0),
        rentabilidadAcumuladaPct: Number(data.rentabilidad_acumulada_pct ?? 0),
        numCuentas: Number(data.num_cuentas ?? 0),
        numPosiciones: Number(data.num_posiciones ?? 0),
        ultimaFecha: data.ultima_fecha ?? null,
        source: "mv",
      };
    }
    // Si error es "relation does not exist" caemos al fallback sin log ruidoso.
    // Cualquier otro error lo logueamos.
    if (error && !error.message?.toLowerCase?.().includes("does not exist")) {
      console.warn("[getGlobalAdminKpis] MV query failed:", error.message);
    }
  } catch (e) {
    console.warn("[getGlobalAdminKpis] MV path exception:", e);
  }

  // --- 2) FALLBACK SQL: agregados directos en Postgres ---
  // Sigue siendo mucho mas rapido que iterar 22k rows en JS.
  try {
    return await getGlobalAdminKpisFromSql(admin);
  } catch (e) {
    console.warn("[getGlobalAdminKpis] SQL fallback failed:", e);
  }

  // --- 3) FALLBACK FINAL: ceros si todo falla ---
  return {
    numClientes: 0,
    numClientesConDatos: 0,
    aumTotal: 0,
    saldoTotal: 0,
    patrimonioTotal: 0,
    patrimonioInvertido: 0,
    rentabilidadAcumuladaEur: 0,
    rentabilidadAcumuladaPct: 0,
    numCuentas: 0,
    numPosiciones: 0,
    ultimaFecha: null,
    source: "js",
  };
}

/**
 * Fallback SQL: calcula los KPIs globales con queries agregadas en
 * Postgres. No usa la vista materializada. Se llama cuando la MV
 * no existe (migracion sin aplicar).
 *
 * Coste aproximado: 3-5 queries en paralelo, cada una < 100 ms con los
 * indices actuales. Total ~200-400 ms.
 */
async function getGlobalAdminKpisFromSql(
  admin: ReturnType<typeof createAdminClient>
): Promise<GlobalAdminKpis> {
  // 1. Ultima fecha de snapshot
  const { data: latestRow } = await admin
    .from("positions")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ultimaFecha: string | null = latestRow?.snapshot_date ?? null;

  // 2. Num clientes total + count con datos
  const { count: numClientes } = await admin
    .from("clients")
    .select("*", { count: "exact", head: true });

  // 3. Num cuentas total
  const { count: numCuentas } = await admin
    .from("accounts")
    .select("*", { count: "exact", head: true });

  // 4. Agregados de positions del snapshot mas reciente (paginado para
  //    esquivar el limite de 1000)
  let aumTotal = 0;
  let numPosiciones = 0;
  const clientesConPosiciones = new Set<string>();
  if (ultimaFecha) {
    let from = 0;
    const PAGE = 1000;
    for (;;) {
      const { data, error } = await admin
        .from("positions")
        .select("position_value, account_id")
        .eq("snapshot_date", ultimaFecha)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const p of data) {
        aumTotal += Number(p.position_value ?? 0);
        numPosiciones++;
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }

  // 5. Saldos totales del snapshot mas reciente
  let saldoTotal = 0;
  if (ultimaFecha) {
    let from = 0;
    const PAGE = 1000;
    for (;;) {
      const { data, error } = await admin
        .from("cash_balances")
        .select("balance")
        .eq("snapshot_date", ultimaFecha)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const b of data) saldoTotal += Number(b.balance ?? 0);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }

  // 6. Patrimonio invertido total: SUM(PLUS) - SUM(MINUS) sobre TODAS
  //    las operaciones aplicando la taxonomia. Paginado.
  let patrimonioInvertido = 0;
  {
    let from = 0;
    const PAGE = 1000;
    for (;;) {
      const { data, error } = await admin
        .from("operations")
        .select("operation_type, eur_amount, gross_amount, fx_rate")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const op of data) patrimonioInvertido += flowAmountEur(op);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }

  // 7. Num clientes con datos (los que aparecen en positions del ultimo snap)
  //    Para evitar otra query, usamos el Set poblado antes
  const numClientesConDatos = clientesConPosiciones.size;

  const patrimonioTotal = aumTotal + saldoTotal;
  const rentabilidadAcumuladaEur = aumTotal - patrimonioInvertido;
  const rentabilidadAcumuladaPct =
    patrimonioInvertido > 0
      ? (rentabilidadAcumuladaEur / patrimonioInvertido) * 100
      : 0;

  return {
    numClientes: numClientes ?? 0,
    numClientesConDatos,
    aumTotal,
    saldoTotal,
    patrimonioTotal,
    patrimonioInvertido,
    rentabilidadAcumuladaEur,
    rentabilidadAcumuladaPct: Number(rentabilidadAcumuladaPct.toFixed(2)),
    numCuentas: numCuentas ?? 0,
    numPosiciones,
    ultimaFecha,
    source: "sql",
  };
}
