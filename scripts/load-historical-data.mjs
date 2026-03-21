#!/usr/bin/env node

/**
 * Script de carga masiva de datos historicos de Mapfre.
 * Lee todos los .xlsx de data/customer data/ y data/mapfre/
 * y los sube a Supabase.
 *
 * Uso: node scripts/load-historical-data.mjs
 *
 * Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, basename } from "path";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import dotenv from "dotenv";

// Load env
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

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
  if (lower.includes("_pos") || lower.includes("posicion")) return "posiciones";
  if (lower.includes("_saldo") || lower.includes("saldo")) return "saldos";
  if (lower.includes("operacion") || lower.includes("registro")) return "operaciones";
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
  // Find header row (row with "FECHA" and "ISIN")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (Array.isArray(row) && row.some((c) => String(c).includes("ISIN"))) {
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
    const row = rows[i];
    if (Array.isArray(row) && row.some((c) => String(c).includes("SALDO"))) {
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
    const row = rows[i];
    if (Array.isArray(row) && row.some((c) => String(c).includes("NUMERO OPERACION"))) {
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
// Account resolution
// ============================================================

const accountCache = new Map();

async function resolveAccountId(accountNumber) {
  if (accountCache.has(accountNumber)) return accountCache.get(accountNumber);

  const { data } = await supabase
    .from("accounts")
    .select("id")
    .eq("account_number", accountNumber)
    .limit(1);

  if (data && data.length > 0) {
    accountCache.set(accountNumber, data[0].id);
    return data[0].id;
  }

  // Create new account
  const { data: newAcc, error } = await supabase
    .from("accounts")
    .insert({ account_number: accountNumber })
    .select("id")
    .single();

  if (error) {
    console.error(`  ⚠ Error creando cuenta ${accountNumber}:`, error.message);
    return null;
  }

  accountCache.set(accountNumber, newAcc.id);
  return newAcc.id;
}

// ============================================================
// Batch insert
// ============================================================

async function batchUpsert(table, rows, conflictCols) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
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
  const dirs = [
    "data/customer data",
    "data/mapfre",
  ];

  const allFiles = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".xlsx"))
      .map((f) => join(dir, f));
    allFiles.push(...files);
  }

  // Sort chronologically
  allFiles.sort((a, b) => basename(a).localeCompare(basename(b)));

  console.log(`\n📊 Rowell — Carga masiva de datos historicos`);
  console.log(`   ${allFiles.length} archivos encontrados\n`);

  const totals = { posiciones: 0, saldos: 0, operaciones: 0, skipped: 0 };

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
        for (const p of parsed) {
          const accountId = await resolveAccountId(p.account_number);
          if (!accountId) continue;
          const { account_number, ...rest } = p;
          rows.push({ ...rest, account_id: accountId });
        }
        const count = await batchUpsert("positions", rows, "account_id,snapshot_date,isin");
        console.log(`${count} filas OK`);
        totals.posiciones += count;

      } else if (type === "saldos") {
        const parsed = parseSaldos(filePath);
        const rows = [];
        for (const s of parsed) {
          const accountId = await resolveAccountId(s.account_number);
          if (!accountId) continue;
          const { account_number, ...rest } = s;
          rows.push({ ...rest, account_id: accountId, cash_account_number: account_number });
        }
        const count = await batchUpsert("cash_balances", rows, "account_id,snapshot_date,cash_account_number");
        console.log(`${count} filas OK`);
        totals.saldos += count;

      } else if (type === "operaciones") {
        const parsed = parseOperaciones(filePath);
        // Dedup by operation_number
        const { data: existingOps } = await supabase
          .from("operations")
          .select("operation_number");
        const existing = new Set((existingOps ?? []).map((o) => o.operation_number));

        const rows = [];
        for (const o of parsed) {
          if (existing.has(o.operation_number)) continue;
          const accountId = await resolveAccountId(o.account_number);
          if (!accountId) continue;
          const { account_number, ...rest } = o;
          rows.push({ ...rest, account_id: accountId });
          existing.add(o.operation_number);
        }
        const count = await batchUpsert("operations", rows, "id");
        console.log(`${count} filas OK`);
        totals.operaciones += count;
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`✅ Carga completada:`);
  console.log(`   Posiciones:  ${totals.posiciones}`);
  console.log(`   Saldos:      ${totals.saldos}`);
  console.log(`   Operaciones: ${totals.operaciones}`);
  console.log(`   Saltados:    ${totals.skipped}`);
  console.log(`${"═".repeat(50)}\n`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
