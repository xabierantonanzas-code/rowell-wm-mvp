#!/usr/bin/env node

/**
 * Script de carga masiva de datos historicos de Mapfre.
 *
 * Uso:
 *   node scripts/load-historical-data.mjs --dir "data/mapfre" --dry-run
 *   node scripts/load-historical-data.mjs --dir "data/mapfre"
 *   node scripts/load-historical-data.mjs  (default: data/customer data + data/mapfre)
 *
 * Flags:
 *   --dir <path>   Solo procesar archivos de este directorio
 *   --dry-run      Mostrar conteos sin escribir en Supabase
 *
 * IMPORTANTE: Nunca crea cuentas nuevas. Si un CV/CE no existe en accounts, se skipea.
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, basename } from "path";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dirIdx = args.indexOf("--dir");
const customDir = dirIdx !== -1 ? args[dirIdx + 1] : null;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================
// Helpers
// ============================================================

function parseEuropeanDate(raw) {
  if (raw instanceof Date) return raw;
  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
    return null;
  }
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
}

function parseNum(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s/g, "");
  if (trimmed === "" || trimmed === "-") return null;
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function detectType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes("_pos") && !lower.includes("ppension")) return "posiciones";
  if (lower.includes("_saldo")) return "saldos";
  if (lower.includes("registro_operaciones")) return "operaciones";
  return "unknown";
}

// ============================================================
// Parsers
// ============================================================

function readSheet(filePath) {
  const buffer = readFileSync(filePath);
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
}

function parsePositions(filePath) {
  const rows = readSheet(filePath);
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (Array.isArray(rows[i]) && rows[i].some((c) => String(c).includes("ISIN"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const results = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r) || r[0] == null) continue;

    const date = parseEuropeanDate(r[0]);
    if (!date) continue;

    const accountNumber = String(r[1] ?? "").trim();
    if (!accountNumber) continue;

    const units = parseNum(r[8]);
    const avgCost = parseNum(r[10]);
    const marketPrice = parseNum(r[11]);
    const positionValue = parseNum(r[12]);

    if (units == null || avgCost == null || marketPrice == null || positionValue == null) continue;

    results.push({
      snapshot_date: formatDate(date),
      account_number: accountNumber,
      isin: String(r[2] ?? "").trim(),
      product_name: String(r[3] ?? "").trim(),
      manager: r[4] ? String(r[4]).trim() : null,
      currency: String(r[6] ?? "EUR").trim() || "EUR",
      units,
      avg_cost: avgCost,
      market_price: marketPrice,
      position_value: positionValue,
      fx_rate: parseNum(r[14]) ?? 1,
      purchase_date: parseEuropeanDate(r[15]) ? formatDate(parseEuropeanDate(r[15])) : null,
    });
  }
  return results;
}

function parseSaldos(filePath) {
  const rows = readSheet(filePath);
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (Array.isArray(rows[i]) && rows[i].some((c) => String(c).includes("SALDO"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const results = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r) || r[0] == null) continue;

    const date = parseEuropeanDate(r[0]);
    if (!date) continue;

    const cashAccountNumber = String(r[1] ?? "").trim();
    if (!cashAccountNumber) continue;

    const balance = parseNum(r[3]) ?? 0;
    const sign = String(r[4] ?? "+").trim() || "+";
    const signedBalance = sign === "-" ? -Math.abs(balance) : Math.abs(balance);

    results.push({
      snapshot_date: formatDate(date),
      account_number: cashAccountNumber,
      currency: String(r[2] ?? "EUR").trim() || "EUR",
      balance: signedBalance,
      sign,
    });
  }
  return results;
}

function parseOperaciones(filePath) {
  const rows = readSheet(filePath);
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (Array.isArray(rows[i]) && rows[i].some((c) => String(c).includes("NUMERO OPERACION"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const results = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r) || r[0] == null) continue;

    const operationDate = parseEuropeanDate(r[14]);
    if (!operationDate) continue;

    const accountNumber = String(r[12] ?? "").trim();
    if (!accountNumber) continue;

    results.push({
      account_number: accountNumber,
      operation_number: String(r[0] ?? "").trim(),
      operation_type: String(r[3] ?? "").trim(),
      isin: r[7] ? String(r[7]).trim() : null,
      product_name: r[8] ? String(r[8]).trim() : null,
      operation_date: formatDate(operationDate),
      settlement_date: parseEuropeanDate(r[15]) ? formatDate(parseEuropeanDate(r[15])) : null,
      currency: String(r[18] ?? "EUR").trim() || "EUR",
      units: parseNum(r[19]) ?? null,
      gross_amount: parseNum(r[21]) ?? null,
      net_amount: parseNum(r[22]) ?? null,
      fx_rate: parseNum(r[23]) ?? 1,
      eur_amount: parseNum(r[24]) ?? null,
      withholding: parseNum(r[26]) ?? 0,
      commission: parseNum(r[28]) ?? 0,
    });
  }
  return results;
}

// ============================================================
// Account resolution — NEVER creates new accounts
// ============================================================

const accountCache = new Map();

async function loadAccountCache() {
  // Pre-load all accounts into cache to avoid N+1 queries
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("accounts")
      .select("id, account_number, ce")
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const acc of data) {
      accountCache.set(acc.account_number, acc.id);
      // Also map CE -> account ID for saldo lookups
      if (acc.ce) accountCache.set(acc.ce, acc.id);
    }
    from += 1000;
    if (data.length < 1000) break;
  }
  console.log(`   ${accountCache.size} cuentas en cache (CV + CE)\n`);
}

function resolveAccountId(accountNumber) {
  return accountCache.get(accountNumber) ?? null;
}

// ============================================================
// Batch upsert with dedup
// ============================================================

async function batchUpsert(table, rows, conflictCols) {
  const colNames = conflictCols.split(",").map((c) => c.trim());
  const seen = new Set();
  const deduped = [];
  for (const row of rows) {
    const key = colNames.map((c) => row[c] ?? "").join("|");
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(row);
    }
  }

  let inserted = 0;
  for (let i = 0; i < deduped.length; i += 500) {
    const batch = deduped.slice(i, i + 500);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflictCols });
    if (error) {
      console.error(`  ⚠ Error en ${table} batch ${i}:`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
}

// ============================================================
// Main
// ============================================================

async function main() {
  const dirs = customDir ? [customDir] : ["data/customer data", "data/mapfre"];

  const allFiles = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      console.error(`❌ Directorio no encontrado: ${dir}`);
      continue;
    }
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".xlsx"))
      .map((f) => join(dir, f));
    allFiles.push(...files);
  }

  allFiles.sort((a, b) => basename(a).localeCompare(basename(b)));

  console.log(`\n📊 Rowell — Carga masiva de datos historicos ${dryRun ? "(DRY RUN)" : ""}`);
  console.log(`   Directorio(s): ${dirs.join(", ")}`);
  console.log(`   ${allFiles.length} archivos encontrados`);

  // Pre-load account cache
  await loadAccountCache();

  const totals = { posiciones: 0, saldos: 0, operaciones: 0, skipped: 0, skippedRows: 0 };

  for (const filePath of allFiles) {
    const fileName = basename(filePath);
    const type = detectType(fileName);

    if (type === "unknown") {
      console.log(`⏭  ${fileName} — tipo desconocido, saltando`);
      totals.skipped++;
      continue;
    }

    process.stdout.write(`📄 ${fileName} (${type})... `);

    try {
      if (type === "posiciones") {
        const parsed = parsePositions(filePath);
        const rows = [];
        let fileSkipped = 0;
        for (const p of parsed) {
          const accountId = resolveAccountId(p.account_number);
          if (!accountId) { fileSkipped++; continue; }
          const { account_number, ...rest } = p;
          rows.push({ ...rest, account_id: accountId });
        }

        if (dryRun) {
          console.log(`${rows.length} filas (${fileSkipped} skipped)`);
          totals.posiciones += rows.length;
        } else {
          const count = await batchUpsert("positions", rows, "account_id,snapshot_date,isin");
          console.log(`${count} filas OK (${fileSkipped} skipped)`);
          totals.posiciones += count;
        }
        totals.skippedRows += fileSkipped;

      } else if (type === "saldos") {
        const parsed = parseSaldos(filePath);
        const rows = [];
        let fileSkipped = 0;
        for (const s of parsed) {
          const accountId = resolveAccountId(s.account_number);
          if (!accountId) { fileSkipped++; continue; }
          const { account_number, ...rest } = s;
          rows.push({ ...rest, account_id: accountId, cash_account_number: account_number });
        }

        if (dryRun) {
          console.log(`${rows.length} filas (${fileSkipped} skipped)`);
          totals.saldos += rows.length;
        } else {
          const count = await batchUpsert("cash_balances", rows, "account_id,snapshot_date,cash_account_number");
          console.log(`${count} filas OK (${fileSkipped} skipped)`);
          totals.saldos += count;
        }
        totals.skippedRows += fileSkipped;

      } else if (type === "operaciones") {
        const parsed = parseOperaciones(filePath);
        const rows = [];
        let fileSkipped = 0;
        for (const o of parsed) {
          const accountId = resolveAccountId(o.account_number);
          if (!accountId) { fileSkipped++; continue; }
          const { account_number, ...rest } = o;
          rows.push({ ...rest, account_id: accountId });
        }

        if (dryRun) {
          console.log(`${rows.length} filas (${fileSkipped} skipped)`);
          totals.operaciones += rows.length;
        } else {
          const count = await batchUpsert("operations", rows, "id");
          console.log(`${count} filas OK (${fileSkipped} skipped)`);
          totals.operaciones += count;
        }
        totals.skippedRows += fileSkipped;
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`${dryRun ? "📋 Dry run" : "✅ Carga"} completada:`);
  console.log(`   Posiciones:    ${totals.posiciones}`);
  console.log(`   Saldos:        ${totals.saldos}`);
  console.log(`   Operaciones:   ${totals.operaciones}`);
  console.log(`   Archivos skip: ${totals.skipped}`);
  console.log(`   Filas skip:    ${totals.skippedRows} (cuenta no encontrada)`);
  console.log(`${"═".repeat(50)}\n`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
