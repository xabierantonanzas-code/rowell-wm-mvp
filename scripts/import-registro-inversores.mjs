#!/usr/bin/env node

/**
 * Importa el Registro de Inversores de Rowell.
 * Vincula aliases (clientes) con cuentas CV/CE en Supabase.
 *
 * Uso:
 *   node scripts/import-registro-inversores.mjs "data/customer data/Registro_Inversores.xlsx" --dry-run
 *   node scripts/import-registro-inversores.mjs "data/customer data/Registro_Inversores.xlsx"
 */

import { readFileSync } from "fs";
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

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");

if (!filePath) {
  console.error("Uso: node scripts/import-registro-inversores.mjs <archivo.xlsx> [--dry-run]");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================
// Parse Excel
// ============================================================

const buffer = readFileSync(filePath);
const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

// Skip header row
const dataRows = rows.slice(1).filter((r) => r[0] != null && String(r[0]).trim() !== "");

// Group by alias (client)
const clientMap = new Map();

for (const r of dataRows) {
  const alias = String(r[0]).trim();
  const agent = r[1] ? String(r[1]).trim() : null;
  const dniHash = r[2] ? String(r[2]).trim() : null;
  const ce = r[6] ? String(r[6]).trim() : null;
  const cv = r[7] ? String(r[7]).trim() : null;
  const aportacion = typeof r[8] === "number" ? r[8] : null;
  const estrategia = r[9] ? String(r[9]).trim() : null;

  if (!clientMap.has(alias)) {
    clientMap.set(alias, { alias, agent, dniHash, accounts: [] });
  }

  if (cv) {
    clientMap.get(alias).accounts.push({ cv, ce, aportacion, estrategia });
  }
}

console.log(`\n📋 Registro de Inversores — ${dryRun ? "DRY RUN" : "EJECUCIÓN REAL"}`);
console.log(`   Archivo: ${filePath}`);
console.log(`   Filas datos: ${dataRows.length}`);
console.log(`   Clientes únicos: ${clientMap.size}`);
console.log(`   Total estrategias: ${dataRows.length}\n`);

// ============================================================
// Preview
// ============================================================

let clientIdx = 0;
for (const [alias, info] of clientMap) {
  clientIdx++;
  console.log(`${clientIdx}. ${alias} (agent: ${info.agent}, dni: ${info.dniHash})`);
  for (const acc of info.accounts) {
    console.log(`   CV: ${acc.cv} | CE: ${acc.ce ?? "—"} | Aport: ${acc.aportacion ?? "—"} | ${acc.estrategia ?? ""}`);
  }
}

if (dryRun) {
  console.log(`\n✅ Dry run completado. ${clientMap.size} clientes, ${dataRows.length} estrategias.`);
  console.log("   Ejecuta sin --dry-run para aplicar cambios.\n");
  process.exit(0);
}

// ============================================================
// Upsert to Supabase
// ============================================================

console.log("\n🔄 Aplicando cambios en Supabase...\n");

let clientsCreated = 0;
let clientsUpdated = 0;
let accountsLinked = 0;
let accountsCreated = 0;
let errors = 0;

for (const [alias, info] of clientMap) {
  try {
    // Find or create client by alias
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("alias", alias)
      .limit(1);

    let clientId;

    if (existingClient && existingClient.length > 0) {
      clientId = existingClient[0].id;
      // Update client fields
      await supabase
        .from("clients")
        .update({
          agent: info.agent,
          dni_hash: info.dniHash,
          full_name: alias, // Use alias as name until real name available
        })
        .eq("id", clientId);
      clientsUpdated++;
    } else {
      // Create new client
      const { data: newClient, error: clientErr } = await supabase
        .from("clients")
        .insert({
          full_name: alias,
          alias,
          agent: info.agent,
          dni_hash: info.dniHash,
        })
        .select("id")
        .single();

      if (clientErr) {
        console.error(`  ❌ Error creando cliente ${alias}:`, clientErr.message);
        errors++;
        continue;
      }
      clientId = newClient.id;
      clientsCreated++;
    }

    // Link accounts
    for (const acc of info.accounts) {
      // Find account by CV (account_number)
      const { data: existingAcc } = await supabase
        .from("accounts")
        .select("id")
        .eq("account_number", acc.cv)
        .limit(1);

      if (existingAcc && existingAcc.length > 0) {
        // Update existing account
        await supabase
          .from("accounts")
          .update({
            client_id: clientId,
            ce: acc.ce,
            aportacion_mensual: acc.aportacion,
            label: acc.estrategia,
            agent: info.agent,
          })
          .eq("id", existingAcc[0].id);
        accountsLinked++;
      } else {
        // Create new account
        const { error: accErr } = await supabase
          .from("accounts")
          .insert({
            account_number: acc.cv,
            client_id: clientId,
            ce: acc.ce,
            aportacion_mensual: acc.aportacion,
            label: acc.estrategia,
            agent: info.agent,
          });

        if (accErr) {
          console.error(`  ⚠ Error creando cuenta ${acc.cv}:`, accErr.message);
          errors++;
        } else {
          accountsCreated++;
        }
      }
    }

    process.stdout.write(`  ✅ ${alias}: ${info.accounts.length} estrategia(s)\n`);
  } catch (err) {
    console.error(`  ❌ Error procesando ${alias}:`, err.message);
    errors++;
  }
}

console.log(`\n${"═".repeat(50)}`);
console.log(`✅ Importación completada:`);
console.log(`   Clientes creados:     ${clientsCreated}`);
console.log(`   Clientes actualizados: ${clientsUpdated}`);
console.log(`   Cuentas vinculadas:    ${accountsLinked}`);
console.log(`   Cuentas creadas:       ${accountsCreated}`);
console.log(`   Errores:               ${errors}`);
console.log(`${"═".repeat(50)}\n`);
