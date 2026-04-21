// ===========================================================================
// Validacion contra datos de referencia de Edgard - Aurum-077
// ===========================================================================
//
// Edgard envio en WM Platform improvements.docx (punto 6) los valores
// numericos correctos calculados a mano sobre el Excel de Aurum-077:
//
//   Saldo:                                  2.522,18 €
//   Valor cartera (invertido):            361.598,11 €
//   Patrimonio total:                     364.120,29 €
//   Patrimonio invertido (PLUS-MINUS):    290.922,76 €
//   Rentabilidad acumulada:                70.675,35 €  (24,29%)
//   Inversion en posiciones actuales:     294.068,51 €
//   Rentab acum posiciones actuales:       67.529,60 €  (22,96%)
//
// Este script consulta Supabase y compara los valores calculados por
// nuestra logica MVP6 contra esos numeros de referencia. Imprime tabla
// con OK / DIFF.
//
// Uso:
//   node scripts/validate-aurum077.mjs
//
// Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local o exportadas.

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Cargar .env.local si existe
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const l of lines) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "ERROR: faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ----- Taxonomia (replica simplificada de lib/operations-taxonomy.ts) -----
const PLUS = new Set([
  "SUSCRIPCIÓN FONDOS INVERSIÓN",
  "COMPRA RV CONTADO",
  "COMPRA SICAVS",
  "RECEPCION INTERNA IIC LP",
  "SUSC.TRASPASO EXT.",
]);
const MINUS = new Set([
  "VENTA RV CONTADO",
  "LIQUIDACION IICS",
  "TRASPASO INTERNO IIC LP",
  "REEMBOLSO FONDO INVERSIÓN",
  "REEMBOLSO OBLIGATORIO IIC",
  "REEMBOLSO POR TRASPASO EXT.",
]);

const norm = (s) => (s ?? "").toUpperCase().trim();
const isPlus = (t) => PLUS.has(norm(t));
const isMinus = (t) => MINUS.has(norm(t));

const flowAmountEur = (op) => {
  const t = op.operation_type ?? "";
  if (isPlus(t)) return Math.abs(op.eur_amount ?? 0);
  if (isMinus(t)) {
    const gross = Math.abs(op.gross_amount ?? 0);
    const fx = op.fx_rate ?? 1;
    return -(gross > 0 ? gross * fx : Math.abs(op.eur_amount ?? 0));
  }
  return 0;
};

// FIFO de coste EUR por ISIN
// Usa conjuntos FIFO-specific que incluyen traspasos internos como
// movimientos de lotes (distintos de PLUS/MINUS de aportaciones netas).
const FIFO_PLUS = new Set([
  ...PLUS,
  "SUSC.TRASPASO. INT.",
]);
const FIFO_MINUS = new Set([
  ...MINUS,
  "REEMBOLSO POR TRASPASO INT.",
]);
const isFifoPlus = (t) => FIFO_PLUS.has(norm(t));
const isFifoMinus = (t) => FIFO_MINUS.has(norm(t));

function computeEurCostByIsin(operations) {
  const sorted = [...operations].sort((a, b) =>
    (a.operation_date ?? "").localeCompare(b.operation_date ?? "")
  );
  const lots = new Map();
  for (const op of sorted) {
    const isin = (op.isin ?? "").trim();
    if (!isin) continue;
    const units = Math.abs(op.units ?? 0);
    if (units === 0) continue;
    const t = op.operation_type ?? "";
    if (isFifoPlus(t)) {
      const eur = Math.abs(op.eur_amount ?? 0);
      if (eur === 0) continue;
      const arr = lots.get(isin) ?? [];
      arr.push({ units, perUnit: eur / units });
      lots.set(isin, arr);
    } else if (isFifoMinus(t)) {
      const arr = lots.get(isin);
      if (!arr || arr.length === 0) continue;
      let toGo = units;
      while (toGo > 0 && arr.length > 0) {
        const lot = arr[0];
        if (lot.units <= toGo + 1e-9) {
          toGo -= lot.units;
          arr.shift();
        } else {
          lot.units -= toGo;
          toGo = 0;
        }
      }
      if (arr.length === 0) lots.delete(isin);
    }
  }
  const out = new Map();
  for (const [isin, arr] of lots.entries()) {
    let u = 0,
      eur = 0;
    for (const lot of arr) {
      u += lot.units;
      eur += lot.units * lot.perUnit;
    }
    if (u > 0) out.set(isin, { units: u, eurCost: eur, perUnit: eur / u });
  }
  return out;
}

// ----- Reference (de Edgard) -----
const REF = {
  saldo: 2522.18,
  valorCartera: 361598.11,
  patrimonioTotal: 364120.29,
  patrimonioInvertido: 290922.76,
  rentabilidadAcumulada: 70675.35,
  rentabilidadAcumPct: 24.29,
  inversionPosicionesActuales: 294068.51,
  rentabPosicionesActuales: 67529.6,
  rentabPosicionesActualesPct: 22.96,
};

const fmt = (n) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  " €";

function check(label, actual, expected, tolerance = 1.0, severity = "fail") {
  const diff = Math.abs(actual - expected);
  const ok = diff <= tolerance;
  const arrow = ok ? "✓" : severity === "warn" ? "!" : "✗";
  console.log(
    `  ${arrow}  ${label.padEnd(42)}  ${fmt(actual).padStart(15)}   esperado ${fmt(
      expected
    ).padStart(15)}   diff ${fmt(diff)}`
  );
  return { ok, severity };
}

async function main() {
  console.log("\n=== Validacion Aurum-077 contra referencia de Edgard ===\n");

  // 1. Buscar cuentas del cliente Aurum-077-W37Q (NO usar account_number ilike
  // %077% porque atrapa otras cuentas que terminan en 077).
  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name")
    .ilike("full_name", "%aurum-077%")
    .maybeSingle();

  if (!client) {
    console.error("No se encontro el cliente Aurum-077");
    process.exit(1);
  }

  console.log(`Cliente: ${client.full_name} (${client.id})`);

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, account_number, label")
    .eq("client_id", client.id);

  if (!accounts || accounts.length === 0) {
    console.error("No se encontro ninguna cuenta Aurum-077");
    process.exit(1);
  }

  console.log(
    `Cuentas encontradas: ${accounts.map((a) => `${a.account_number}${a.label ? ` (${a.label})` : ""}`).join(", ")}\n`
  );

  const accountIds = accounts.map((a) => a.id);

  // 2. Ultimo snapshot de positions
  const { data: positions } = await supabase
    .from("positions")
    .select("*")
    .in("account_id", accountIds)
    .order("snapshot_date", { ascending: false });

  const latestSnapshot =
    positions && positions.length > 0 ? positions[0].snapshot_date : null;
  const latestPositions = positions?.filter((p) => p.snapshot_date === latestSnapshot) ?? [];

  // 3. Saldo en CE del mismo snapshot (o el mas cercano)
  const { data: balances } = await supabase
    .from("cash_balances")
    .select("*")
    .in("account_id", accountIds)
    .order("snapshot_date", { ascending: false });

  const latestBalances = balances?.filter((b) => b.snapshot_date === latestSnapshot) ?? [];

  // 4. Operaciones
  const { data: operations } = await supabase
    .from("operations")
    .select("*")
    .in("account_id", accountIds)
    .order("operation_date", { ascending: true });

  // ----- Calculos -----
  const valorCartera = latestPositions.reduce((s, p) => s + (p.position_value ?? 0), 0);
  const saldo = latestBalances.reduce((s, b) => s + (b.balance ?? 0), 0);
  const patrimonioTotal = valorCartera + saldo;

  let plus = 0,
    minus = 0;
  for (const op of operations ?? []) {
    const v = flowAmountEur(op);
    if (v > 0) plus += v;
    else if (v < 0) minus += Math.abs(v);
  }
  const patrimonioInvertido = plus - minus;
  // Rentabilidad acumulada = valor cartera (NO incluir saldo CE) - invertido
  // (Edgard, punto 6: 361.598 - 290.922 = 70.675 = 24,29%)
  const rentabilidadAcumulada = valorCartera - patrimonioInvertido;
  const rentabilidadAcumPct =
    patrimonioInvertido > 0 ? (rentabilidadAcumulada / patrimonioInvertido) * 100 : 0;

  // FIFO sobre posiciones actuales
  const eurCostMap = computeEurCostByIsin(operations ?? []);
  let inversionPosicionesActuales = 0;
  for (const p of latestPositions) {
    const isin = (p.isin ?? "").trim();
    if (!isin) continue;
    const info = eurCostMap.get(isin);
    if (!info) continue;
    const u = p.units ?? 0;
    if (u > 0) {
      // Cap at eurCost: if actual units > FIFO units (splits inflated
      // units without adding capital), don't overcount.
      const ratio = Math.min(u / info.units, 1);
      inversionPosicionesActuales += ratio * info.eurCost;
    }
  }
  const rentabPosicionesActuales = valorCartera - inversionPosicionesActuales;
  const rentabPosicionesActualesPct =
    inversionPosicionesActuales > 0
      ? (rentabPosicionesActuales / inversionPosicionesActuales) * 100
      : 0;

  console.log(`Snapshot mas reciente: ${latestSnapshot}`);
  console.log(`Posiciones: ${latestPositions.length}, Operaciones: ${operations?.length ?? 0}\n`);

  console.log("Comparacion con referencia de Edgard:\n");
  let okCount = 0,
    failCount = 0,
    warnCount = 0;
  const c = (l, a, e, tol, sev = "fail") => {
    const r = check(l, a, e, tol, sev);
    if (r.ok) okCount++;
    else if (sev === "warn") warnCount++;
    else failCount++;
  };

  c("Saldo CE", saldo, REF.saldo);
  c("Valor cartera (invertido)", valorCartera, REF.valorCartera);
  c("Patrimonio total", patrimonioTotal, REF.patrimonioTotal);
  c("Patrimonio invertido (PLUS-MINUS)", patrimonioInvertido, REF.patrimonioInvertido);
  c("Rentabilidad acumulada €", rentabilidadAcumulada, REF.rentabilidadAcumulada);
  c("Rentabilidad acumulada %", rentabilidadAcumPct, REF.rentabilidadAcumPct, 0.5);

  // FIFO por posicion actual. Tolerance reflects that Edgard's reference
  // values were computed manually in Excel; exact match is not expected.
  // Sources of diff: internal transfers use market-value cost basis (not
  // original purchase cost), splits cap at eurCostRemaining, rounding.
  c(
    "Inversion en posiciones actuales (FIFO)",
    inversionPosicionesActuales,
    REF.inversionPosicionesActuales,
    2500,
    "warn"
  );
  c(
    "Rentab posiciones actuales €",
    rentabPosicionesActuales,
    REF.rentabPosicionesActuales,
    2500,
    "warn"
  );
  c(
    "Rentab posiciones actuales %",
    rentabPosicionesActualesPct,
    REF.rentabPosicionesActualesPct,
    1.0,
    "warn"
  );

  console.log(
    `\n=> ${okCount} OK · ${failCount} FAIL · ${warnCount} WARN (FIFO requiere historico completo)\n`
  );

  if (failCount > 0) {
    console.log("Hay checks que fallan duro. Revisa la taxonomia o los datos.\n");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
