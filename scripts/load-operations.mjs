// ===========================================================================
// Carga masiva del Registro de Operaciones a Supabase
// ===========================================================================
//
// Sube data/customer data/Registro_Operaciones.xlsx (o el path que pases por
// argumento) a la tabla operations. Resuelve account_id por account_number,
// dedup por operation_number e inserta en lotes de 500.
//
// Uso:
//   node scripts/load-operations.mjs
//   node scripts/load-operations.mjs path/to/file.xlsx
//
// Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

// Cargar .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const l of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ----- Parseo Excel -----
const filePath =
  process.argv[2] ?? "data/customer data/Registro_Operaciones.xlsx";

if (!fs.existsSync(filePath)) {
  console.error(`No existe el archivo: ${filePath}`);
  process.exit(1);
}

console.log(`Leyendo ${filePath}...`);
const buf = fs.readFileSync(filePath);
const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
const sh = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null });

// Header en fila 3 (index 2): "NUMERO OPERACION", ...
const HEADER_ROW = 2;
const headers = rows[HEADER_ROW];
console.log(`Headers (${headers.length}): ${headers.slice(0, 6).join(" | ")}...`);

const colIdx = {};
const aliases = {
  operationNumber: ["numero operacion"],
  operationType: ["tipo de operacion ib"],
  isin: ["codigo isin"],
  productName: ["nombre producto"],
  accountNumber: ["cuenta valores cliente"],
  operationDate: ["fecha de contratacion"],
  settlementDate: ["fecha valor/ejec/liqui"],
  currency: ["divisa"],
  units: ["numero de titulos"],
  grossAmount: ["efectivo bruto"],
  netAmount: ["efectivo neto"],
  fxRate: ["cambio de la divisa"],
  eurAmount: ["contravalor efectivo neto"],
  withholding: ["importe retencion"],
  commission: ["importe comision"],
};

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

for (let c = 0; c < headers.length; c++) {
  const h = norm(headers[c]);
  for (const [key, alts] of Object.entries(aliases)) {
    if (colIdx[key] !== undefined) continue;
    if (alts.some((a) => h.includes(norm(a)))) colIdx[key] = c;
  }
}

const missing = Object.keys(aliases).filter((k) => colIdx[k] === undefined);
if (missing.length > 0) {
  console.error("Faltan columnas:", missing.join(", "));
  process.exit(1);
}
console.log("Columnas mapeadas OK");

const parseNum = (raw) => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/\s/g, "");
  if (!t || t === "-") return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const parseDate = (raw) => {
  if (raw instanceof Date) return raw.toISOString().split("T")[0];
  if (typeof raw === "number") {
    const p = XLSX.SSF.parse_date_code(raw);
    if (p) {
      const d = new Date(p.y, p.m - 1, p.d);
      return d.toISOString().split("T")[0];
    }
    return null;
  }
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};

const parsed = [];
for (let i = HEADER_ROW + 1; i < rows.length; i++) {
  const r = rows[i];
  if (!Array.isArray(r) || r.every((c) => c == null || c === "")) continue;
  const accountNumber = String(r[colIdx.accountNumber] ?? "").trim();
  const opType = String(r[colIdx.operationType] ?? "").trim();
  const opDate = parseDate(r[colIdx.operationDate]);
  if (!accountNumber || !opType || !opDate) continue;

  parsed.push({
    operation_number: String(r[colIdx.operationNumber] ?? "").trim() || null,
    operation_type: opType,
    isin: r[colIdx.isin] ? String(r[colIdx.isin]).trim() : null,
    product_name: r[colIdx.productName] ? String(r[colIdx.productName]).trim() : null,
    accountNumber,
    operation_date: opDate,
    settlement_date: parseDate(r[colIdx.settlementDate]),
    currency: String(r[colIdx.currency] ?? "EUR").trim() || "EUR",
    units: parseNum(r[colIdx.units]),
    gross_amount: parseNum(r[colIdx.grossAmount]),
    net_amount: parseNum(r[colIdx.netAmount]),
    fx_rate: parseNum(r[colIdx.fxRate]) ?? 1,
    eur_amount: parseNum(r[colIdx.eurAmount]),
    withholding: parseNum(r[colIdx.withholding]) ?? 0,
    commission: parseNum(r[colIdx.commission]) ?? 0,
  });
}

console.log(`Operaciones parseadas validas: ${parsed.length}`);

// ----- Resolver account_id por account_number -----
const uniqueAccounts = [...new Set(parsed.map((p) => p.accountNumber))];
console.log(`Cuentas unicas en archivo: ${uniqueAccounts.length}`);

const { data: existing } = await supabase
  .from("accounts")
  .select("id, account_number")
  .in("account_number", uniqueAccounts);

const accountIdByNumber = new Map(existing.map((a) => [a.account_number, a.id]));
const missingAccounts = uniqueAccounts.filter(
  (n) => !accountIdByNumber.has(n)
);

if (missingAccounts.length > 0) {
  console.log(`Creando ${missingAccounts.length} cuentas nuevas...`);
  const { data: created, error } = await supabase
    .from("accounts")
    .insert(missingAccounts.map((n) => ({ account_number: n })))
    .select();
  if (error) {
    console.error("Error creando cuentas:", error.message);
    process.exit(1);
  }
  for (const a of created) accountIdByNumber.set(a.account_number, a.id);
}

// ----- Mapear a registros finales -----
const records = parsed
  .map((p) => {
    const account_id = accountIdByNumber.get(p.accountNumber);
    if (!account_id) return null;
    const { accountNumber, ...rest } = p;
    return { account_id, ...rest };
  })
  .filter(Boolean);

// Dedup por operation_number
const seen = new Set();
const dedup = [];
for (const r of records) {
  if (!r.operation_number) {
    dedup.push(r);
    continue;
  }
  if (seen.has(r.operation_number)) continue;
  seen.add(r.operation_number);
  dedup.push(r);
}
console.log(`Records a insertar (dedup): ${dedup.length}`);

// ----- Insertar en lotes -----
let inserted = 0;
let errors = 0;
const BATCH = 500;
for (let i = 0; i < dedup.length; i += BATCH) {
  const batch = dedup.slice(i, i + BATCH);
  // upsert por operation_number para idempotencia
  const { error, count } = await supabase
    .from("operations")
    .upsert(batch, {
      onConflict: "operation_number",
      ignoreDuplicates: false,
      count: "exact",
    });
  if (error) {
    console.error(`Batch ${i}-${i + batch.length}: ${error.message}`);
    errors++;
  } else {
    inserted += batch.length;
    process.stdout.write(`\r  Insertado: ${inserted}/${dedup.length}`);
  }
}
console.log(`\nTotal insertado: ${inserted}, errores: ${errors}`);
