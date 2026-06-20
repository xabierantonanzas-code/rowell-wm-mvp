// ===========================================================================
// Diagnóstico de flujos (aportaciones netas) por cliente — READ ONLY
// ===========================================================================
//
// Para entender por qué el "Patrimonio invertido" (= Σ flowAmountEur) sale
// raro (p. ej. negativo) en algún cliente. Replica EXACTA de la taxonomía de
// aportaciones de lib/operations-taxonomy.ts (la misma que usa el dashboard).
//
// Desglosa las operaciones por operation_type con su clasificación
// PLUS/MINUS/NEUTRO y la suma de flujo, y luego por ISIN para detectar
// traspasos internos cuyas dos patas NO netean (causa típica del negativo).
//
// NO escribe nada. Uso:
//   node scripts/diagnose-flows.mjs                 # default: helio-142
//   node scripts/diagnose-flows.mjs aurum-077       # otro cliente (substring)
//
// Requiere SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en .env.local o exportadas.

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const l of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ----- Taxonomía de aportaciones netas (réplica de operations-taxonomy.ts) -----
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
const classify = (t) => (PLUS.has(norm(t)) ? "PLUS" : MINUS.has(norm(t)) ? "MINUS" : "NEUTRO");
const flowAmountEur = (op) => {
  const t = op.operation_type ?? "";
  if (PLUS.has(norm(t))) return Math.abs(op.eur_amount ?? 0);
  if (MINUS.has(norm(t))) {
    const gross = Math.abs(op.gross_amount ?? 0);
    const fx = op.fx_rate ?? 1;
    return -(gross > 0 ? gross * fx : Math.abs(op.eur_amount ?? 0));
  }
  return 0;
};

const eur = (n) => (n ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

const needle = (process.argv[2] ?? "helio-142").toLowerCase();

async function main() {
  // 1) Cliente por full_name (NUNCA por account_number, ver CLAUDE.md)
  const { data: clients, error: cErr } = await supabase
    .from("clients")
    .select("id, full_name")
    .ilike("full_name", `%${needle}%`);
  if (cErr) { console.error("Error clients:", cErr.message); process.exit(1); }
  if (!clients?.length) { console.error(`Sin cliente que case con "${needle}"`); process.exit(1); }
  if (clients.length > 1) console.log("Aviso: varios clientes casan, uso el primero:", clients.map((c) => c.full_name).join(", "));
  const client = clients[0];
  console.log(`\n=== Cliente: ${client.full_name} (${client.id}) ===\n`);

  // 2) Cuentas del cliente (operations/positions enlazan por account_id)
  const { data: accounts, error: aErr } = await supabase
    .from("accounts")
    .select("id, account_number, label")
    .eq("client_id", client.id);
  if (aErr) { console.error("Error accounts:", aErr.message); process.exit(1); }
  if (!accounts?.length) { console.error("Sin cuentas para el cliente"); process.exit(1); }
  const accountIds = accounts.map((a) => a.id);
  console.log(`Cuentas: ${accounts.map((a) => a.account_number + (a.label ? ` (${a.label})` : "")).join(", ")}\n`);

  // 3) Operaciones
  const { data: ops, error: oErr } = await supabase
    .from("operations")
    .select("operation_type, operation_date, isin, product_name, eur_amount, gross_amount, fx_rate, units")
    .in("account_id", accountIds);
  if (oErr) { console.error("Error operations:", oErr.message); process.exit(1); }
  console.log(`Operaciones: ${ops.length}\n`);

  // 3) Desglose por operation_type
  const byType = new Map();
  for (const op of ops) {
    const t = norm(op.operation_type);
    const cls = classify(t);
    const flow = flowAmountEur(op);
    const e = byType.get(t) ?? { cls, n: 0, flow: 0, eur: 0, gross: 0 };
    e.n += 1; e.flow += flow; e.eur += Math.abs(op.eur_amount ?? 0); e.gross += Math.abs(op.gross_amount ?? 0);
    byType.set(t, e);
  }
  console.log("--- Por tipo de operación ---");
  console.log("CLASE   N    Σ FLUJO".padEnd(34) + "TIPO");
  let total = 0;
  const rows = [...byType.entries()].sort((a, b) => a[1].flow - b[1].flow);
  for (const [t, e] of rows) {
    total += e.flow;
    console.log(`${e.cls.padEnd(7)} ${String(e.n).padStart(3)}  ${eur(e.flow).padStart(16)}   ${t}`);
  }
  console.log("-".repeat(60));
  console.log(`TOTAL aportaciones netas (Patrimonio invertido): ${eur(total)}\n`);

  // 4) Alerta: tipos NEUTRO con dinero (posible clasificación incompleta)
  const neutroConDinero = rows.filter(([, e]) => e.cls === "NEUTRO" && e.eur > 1);
  if (neutroConDinero.length) {
    console.log("⚠  Tipos NEUTRO con importe (no cuentan como flujo — ¿deberían?):");
    for (const [t, e] of neutroConDinero) console.log(`   ${t}: ${e.n} ops, Σ eur_amount ${eur(e.eur)}`);
    console.log("");
  }

  // 5) Neteo por ISIN: detecta traspasos cuyas patas no se compensan
  const byIsin = new Map();
  for (const op of ops) {
    const isin = (op.isin ?? "").trim() || "(sin ISIN)";
    const e = byIsin.get(isin) ?? { name: op.product_name, plus: 0, minus: 0, neutro: 0 };
    const cls = classify(op.operation_type);
    const flow = flowAmountEur(op);
    if (cls === "PLUS") e.plus += flow;
    else if (cls === "MINUS") e.minus += flow;
    else e.neutro += Math.abs(op.eur_amount ?? 0);
    byIsin.set(isin, e);
  }
  console.log("--- Neteo por ISIN (PLUS + MINUS = flujo neto) ---");
  for (const [isin, e] of [...byIsin.entries()].sort((a, b) => (a[1].plus + a[1].minus) - (b[1].plus + b[1].minus))) {
    const net = e.plus + e.minus;
    const flag = e.neutro > 1 && Math.abs(e.plus) + Math.abs(e.minus) > 1 ? "  ← tiene patas NEUTRO con dinero" : "";
    console.log(`${isin}  neto ${eur(net).padStart(15)}  (PLUS ${eur(e.plus)} / MINUS ${eur(e.minus)} / NEUTRO€ ${eur(e.neutro)})${flag}`);
    if (e.name) console.log(`   ${e.name}`);
  }

  // 6) Reproducir los tiles
  const { data: pos } = await supabase
    .from("positions")
    .select("position_value, snapshot_date")
    .in("account_id", accountIds);
  let valorCartera = 0;
  if (pos?.length) {
    const last = pos.reduce((m, p) => (p.snapshot_date > m ? p.snapshot_date : m), pos[0].snapshot_date);
    valorCartera = pos.filter((p) => p.snapshot_date === last).reduce((s, p) => s + (p.position_value ?? 0), 0);
  }
  const rentab = valorCartera - total;
  const pct = total > 0 ? (rentab / total) * 100 : null;
  console.log("\n--- Tiles del Resumen ---");
  console.log(`Valor cartera:          ${eur(valorCartera)}`);
  console.log(`Patrimonio invertido:   ${eur(total)}`);
  console.log(`Rentabilidad acumulada: ${eur(rentab)}  (${pct == null ? "N/A — invertido ≤ 0" : pct.toFixed(2) + " %"})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
