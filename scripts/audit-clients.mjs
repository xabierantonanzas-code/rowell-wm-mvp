// ===========================================================================
// Auditoría de datos de TODOS los clientes en Supabase
// ===========================================================================
//
// Responde a la pregunta "¿están todos los clientes con datos reales y
// actualizados?". Para cada cliente (agregando sus cuentas) calcula, a partir
// de lo que HAY en Supabase:
//   - última fecha de snapshot (positions)
//   - valor de cartera (Σ position_value del último snapshot)
//   - saldo CE (Σ balance del último snapshot)
//   - capital invertido (Σ flowAmountEur, taxonomía PLUS/MINUS de producción)
//   - rentabilidad simple = (valor − invertido) / invertido
//   - nº posiciones, nº operaciones
// y marca avisos: SIN_DATOS, STALE (no al día), SIN_POSICIONES, SIN_OPS, CI<=0.
//
// Imprime un resumen + la lista de clientes con avisos, y vuelca un CSV
// completo (audit-clients-report.csv) para revisar los 124 de un vistazo.
//
// Uso:  node scripts/audit-clients.mjs
// Requiere SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en .env.local.
//
// NOTA: usa la taxonomía/fórmula MINUS de PRODUCCIÓN (BRUTO×FX), no la D6 del
// modelo. Sirve para ver cobertura/frescura de datos, no para validar al
// céntimo cada rentabilidad (eso es validate-aurum077 / el harness de 20 CV).

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
  console.error("ERROR: faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PLUS = new Set([
  "SUSCRIPCIÓN FONDOS INVERSIÓN", "COMPRA RV CONTADO", "COMPRA SICAVS",
  "RECEPCION INTERNA IIC LP", "SUSC.TRASPASO EXT.", "RECEPCION IIC LIBRE PAGO",
]);
const MINUS = new Set([
  "VENTA RV CONTADO", "LIQUIDACION IICS", "TRASPASO INTERNO IIC LP",
  "REEMBOLSO FONDO INVERSIÓN", "REEMBOLSO OBLIGATORIO IIC", "REEMBOLSO POR TRASPASO EXT.",
]);
const norm = (s) => (s ?? "").toUpperCase().trim();
const flowAmountEur = (op) => {
  const t = norm(op.operation_type);
  if (PLUS.has(t)) return Math.abs(op.eur_amount ?? 0);
  if (MINUS.has(t)) {
    const gross = Math.abs(op.gross_amount ?? 0);
    const fx = op.fx_rate ?? 1;
    return -(gross > 0 ? gross * fx : Math.abs(op.eur_amount ?? 0));
  }
  return 0;
};

const eur = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
  console.log("\n=== Auditoría de datos · todos los clientes ===\n");

  // Fecha global del último snapshot (referencia de "al día").
  const { data: lastSnap } = await supabase
    .from("positions").select("snapshot_date")
    .order("snapshot_date", { ascending: false }).limit(1);
  const globalLatest = lastSnap?.[0]?.snapshot_date ?? null;
  console.log(`Último snapshot global: ${globalLatest ?? "—"}\n`);

  const { data: clients } = await supabase.from("clients").select("id, full_name");
  const { data: accounts } = await supabase.from("accounts").select("id, client_id, account_number");
  if (!clients || !accounts) { console.error("No se pudieron leer clients/accounts"); process.exit(1); }

  const accByClient = new Map();
  for (const a of accounts) {
    if (!a.client_id) continue;
    if (!accByClient.has(a.client_id)) accByClient.set(a.client_id, []);
    accByClient.get(a.client_id).push(a);
  }

  const rows = [];
  let done = 0;
  for (const cl of clients.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "es"))) {
    const accs = accByClient.get(cl.id) ?? [];
    const accIds = accs.map((a) => a.id);
    process.stdout.write(`\r  procesando ${++done}/${clients.length}   `);
    if (accIds.length === 0) {
      rows.push({ name: cl.full_name, accs: 0, latest: null, valor: 0, saldo: 0, ci: 0, simple: null, nPos: 0, nOps: 0, flags: ["SIN_CUENTAS"] });
      continue;
    }

    // Positions: traer las más recientes (limit alto) y quedarnos con el último snapshot.
    const { data: pos } = await supabase
      .from("positions").select("snapshot_date, position_value, isin")
      .in("account_id", accIds).order("snapshot_date", { ascending: false }).limit(2000);
    const latest = pos?.[0]?.snapshot_date ?? null;
    const latestPos = (pos ?? []).filter((p) => p.snapshot_date === latest);
    const valor = latestPos.reduce((s, p) => s + (p.position_value ?? 0), 0);

    const { data: bal } = await supabase
      .from("cash_balances").select("snapshot_date, balance")
      .in("account_id", accIds).order("snapshot_date", { ascending: false }).limit(2000);
    const latestBal = (bal ?? []).filter((b) => b.snapshot_date === latest);
    const saldo = latestBal.reduce((s, b) => s + (b.balance ?? 0), 0);

    const { data: ops } = await supabase
      .from("operations").select("operation_type, eur_amount, gross_amount, fx_rate")
      .in("account_id", accIds);
    let ci = 0;
    for (const op of ops ?? []) ci += flowAmountEur(op);
    const simple = ci > 0 ? (valor - ci) / ci : null;

    const flags = [];
    if (!latest) flags.push("SIN_DATOS");
    else if (globalLatest && latest !== globalLatest) flags.push("STALE");
    if (latestPos.length === 0) flags.push("SIN_POSICIONES");
    if ((ops?.length ?? 0) === 0) flags.push("SIN_OPS");
    if (ci <= 0) flags.push("CI<=0");

    rows.push({ name: cl.full_name, accs: accIds.length, latest, valor, saldo, ci, simple, nPos: latestPos.length, nOps: ops?.length ?? 0, flags });
  }
  process.stdout.write("\r" + " ".repeat(40) + "\r");

  // CSV
  const csv = ["cliente,cuentas,ultimo_snapshot,valor_cartera,saldo,capital_invertido,simple_pct,n_posiciones,n_ops,avisos"];
  for (const r of rows) {
    csv.push([
      `"${(r.name ?? "").replace(/"/g, "'")}"`, r.accs, r.latest ?? "",
      r.valor.toFixed(2), r.saldo.toFixed(2), r.ci.toFixed(2),
      r.simple == null ? "" : (r.simple * 100).toFixed(2), r.nPos, r.nOps,
      `"${r.flags.join("|")}"`,
    ].join(","));
  }
  const out = path.join(process.cwd(), "audit-clients-report.csv");
  fs.writeFileSync(out, csv.join("\n"), "utf8");

  // Resumen
  const total = rows.length;
  const alDia = rows.filter((r) => r.latest === globalLatest).length;
  const stale = rows.filter((r) => r.flags.includes("STALE")).length;
  const sinDatos = rows.filter((r) => r.flags.includes("SIN_DATOS")).length;
  const conAvisos = rows.filter((r) => r.flags.length > 0);

  console.log(`Clientes:            ${total}`);
  console.log(`Al día (${globalLatest}):  ${alDia}`);
  console.log(`Stale (no al día):   ${stale}`);
  console.log(`Sin datos:           ${sinDatos}`);
  console.log(`Con algún aviso:     ${conAvisos.length}`);
  console.log(`\nCSV completo: ${out}\n`);

  if (conAvisos.length) {
    console.log("Clientes con avisos:");
    for (const r of conAvisos.slice(0, 60)) {
      console.log(`  ${(r.name ?? "—").padEnd(22)} ${(r.latest ?? "sin snapshot").padEnd(12)}  valor ${eur(r.valor).padStart(14)}  [${r.flags.join(", ")}]`);
    }
    if (conAvisos.length > 60) console.log(`  … y ${conAvisos.length - 60} más (ver CSV)`);
  } else {
    console.log("✓ Todos los clientes tienen datos y están al día.");
  }
  console.log("");
}

main().catch((e) => { console.error(e); process.exit(1); });
