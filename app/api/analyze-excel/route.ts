import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security";
import { captureError } from "@/lib/error";
import * as XLSX from "xlsx";

/**
 * POST /api/analyze-excel
 * Analyzes Excel files before uploading. Returns AI analysis of structure and data quality.
 * Admin/owner only.
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const formData = await req.formData();
    const analyses: Record<string, FileAnalysis> = {};

    for (const key of ["posiciones", "operaciones", "saldos"]) {
      const file = formData.get(key) as File | null;
      if (!file) continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      const analysis = analyzeFile(buffer, file.name, key);
      analyses[key] = analysis;
    }

    if (Object.keys(analyses).length === 0) {
      return NextResponse.json({ error: "No se recibieron archivos" }, { status: 400 });
    }

    // Build AI prompt with file analysis
    const aiAnalysis = await getAIAnalysis(analyses);

    return NextResponse.json({
      analyses,
      aiAnalysis,
    });
  } catch (err) {
    captureError(err, "Analyze Excel");
    return NextResponse.json({ error: "Error analizando archivos" }, { status: 500 });
  }
}

// ===========================================================================
// Types
// ===========================================================================

interface FileAnalysis {
  fileName: string;
  fileType: string;
  sheetNames: string[];
  totalRows: number;
  columns: string[];
  sampleRows: Record<string, any>[];
  issues: string[];
  detectedType: string | null; // "posiciones" | "operaciones" | "saldos" | null
}

// ===========================================================================
// File Analysis
// ===========================================================================

const EXPECTED_COLUMNS: Record<string, string[]> = {
  posiciones: [
    "numero de cuenta", "fecha", "isin", "descripcion", "gestora",
    "divisa", "titulos", "cambio", "precio", "valoracion", "coste medio",
  ],
  operaciones: [
    "numero de cuenta", "numero de operacion", "tipo de operacion",
    "isin", "descripcion", "fecha operacion", "fecha liquidacion",
    "divisa", "titulos", "bruto", "neto", "cambio", "importe eur",
  ],
  saldos: [
    "numero de cuenta", "cuenta de efectivo", "divisa", "fecha", "saldo", "signo",
  ],
};

function analyzeFile(buffer: Buffer, fileName: string, expectedType: string): FileAnalysis {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = workbook.SheetNames;
  const issues: string[] = [];

  // Use first sheet
  const sheet = workbook.Sheets[sheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

  const columns = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
  const sampleRows = jsonData.slice(0, 5);

  // Detect type by matching columns
  let detectedType: string | null = null;
  let bestMatch = 0;

  for (const [type, expectedCols] of Object.entries(EXPECTED_COLUMNS)) {
    const normalizedColumns = columns.map((c) => c.toLowerCase().trim());
    const matchCount = expectedCols.filter((ec) =>
      normalizedColumns.some((nc) => nc.includes(ec) || ec.includes(nc))
    ).length;
    const matchPct = matchCount / expectedCols.length;
    if (matchPct > bestMatch) {
      bestMatch = matchPct;
      detectedType = type;
    }
  }

  // Check for issues
  if (jsonData.length === 0) {
    issues.push("El archivo esta vacio (0 filas de datos)");
  }

  if (detectedType !== expectedType && bestMatch < 0.5) {
    issues.push(
      `Las columnas no coinciden con el formato esperado de "${expectedType}". ` +
      `Se detecta como "${detectedType ?? "desconocido"}" (${(bestMatch * 100).toFixed(0)}% coincidencia).`
    );
  }

  // Check for expected columns that are missing
  const expectedCols = EXPECTED_COLUMNS[expectedType] ?? [];
  const normalizedColumns = columns.map((c) => c.toLowerCase().trim());
  const missingCols = expectedCols.filter(
    (ec) => !normalizedColumns.some((nc) => nc.includes(ec) || ec.includes(nc))
  );
  if (missingCols.length > 0 && missingCols.length < expectedCols.length) {
    issues.push(`Columnas posiblemente faltantes: ${missingCols.join(", ")}`);
  }

  // Check for empty/null values in key columns
  if (jsonData.length > 0) {
    const emptyCountByCol: Record<string, number> = {};
    for (const row of jsonData) {
      for (const col of columns) {
        if (row[col] === "" || row[col] === null || row[col] === undefined) {
          emptyCountByCol[col] = (emptyCountByCol[col] ?? 0) + 1;
        }
      }
    }
    for (const [col, count] of Object.entries(emptyCountByCol)) {
      const pct = (count / jsonData.length) * 100;
      if (pct > 50) {
        issues.push(`Columna "${col}" tiene ${pct.toFixed(0)}% valores vacios`);
      }
    }
  }

  return {
    fileName,
    fileType: expectedType,
    sheetNames,
    totalRows: jsonData.length,
    columns,
    sampleRows,
    issues,
    detectedType,
  };
}

// ===========================================================================
// AI Analysis (Claude API)
// ===========================================================================

async function getAIAnalysis(
  analyses: Record<string, FileAnalysis>
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // If no API key, return a basic analysis without AI
  if (!apiKey) {
    return buildBasicAnalysis(analyses);
  }

  const prompt = buildPrompt(analyses);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error("Claude API error:", response.status);
      return buildBasicAnalysis(analyses);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";
    return text || buildBasicAnalysis(analyses);
  } catch (err) {
    console.error("AI analysis failed, using basic:", err);
    return buildBasicAnalysis(analyses);
  }
}

function buildPrompt(analyses: Record<string, FileAnalysis>): string {
  let prompt = `Eres un analista de datos financieros de Rowell Patrimonios. Analiza estos ficheros Excel que un administrador quiere cargar en el sistema de gestion de carteras.

Responde en español, de forma clara y concisa. Usa estos emojis: ✅ para OK, ⚠️ para advertencia, ❌ para error.

Estructura tu respuesta asi:
1. Resumen general (1-2 lineas)
2. Por cada fichero: estado, filas, problemas detectados
3. Recomendacion final: "Seguro para cargar" o "Revisar antes de cargar" con motivo

`;

  for (const [type, analysis] of Object.entries(analyses)) {
    prompt += `\n--- FICHERO: ${analysis.fileName} (tipo: ${type}) ---\n`;
    prompt += `Hojas: ${analysis.sheetNames.join(", ")}\n`;
    prompt += `Filas: ${analysis.totalRows}\n`;
    prompt += `Columnas encontradas: ${analysis.columns.join(", ")}\n`;
    prompt += `Tipo detectado automaticamente: ${analysis.detectedType ?? "no identificado"}\n`;

    if (analysis.issues.length > 0) {
      prompt += `Problemas detectados:\n`;
      for (const issue of analysis.issues) {
        prompt += `  - ${issue}\n`;
      }
    }

    if (analysis.sampleRows.length > 0) {
      prompt += `Primeras ${analysis.sampleRows.length} filas de ejemplo:\n`;
      prompt += JSON.stringify(analysis.sampleRows.slice(0, 3), null, 2) + "\n";
    }
  }

  prompt += `\nColumnas esperadas por el sistema:\n`;
  for (const [type, cols] of Object.entries(EXPECTED_COLUMNS)) {
    prompt += `  ${type}: ${cols.join(", ")}\n`;
  }

  return prompt;
}

function buildBasicAnalysis(analyses: Record<string, FileAnalysis>): string {
  const lines: string[] = ["**Analisis automatico (sin IA)**\n"];

  for (const [type, analysis] of Object.entries(analyses)) {
    const icon = analysis.issues.length === 0 ? "✅" : "⚠️";
    lines.push(`${icon} **${analysis.fileName}** (${type})`);
    lines.push(`   ${analysis.totalRows} filas, ${analysis.columns.length} columnas`);

    if (analysis.issues.length > 0) {
      for (const issue of analysis.issues) {
        lines.push(`   ⚠️ ${issue}`);
      }
    } else {
      lines.push(`   Formato correcto`);
    }
    lines.push("");
  }

  const hasIssues = Object.values(analyses).some((a) => a.issues.length > 0);
  lines.push(
    hasIssues
      ? "**Recomendacion:** ⚠️ Revisar los problemas antes de cargar"
      : "**Recomendacion:** ✅ Seguro para cargar"
  );

  return lines.join("\n");
}
