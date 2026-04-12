"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Search,
  Bot,
  ArrowRight,
} from "lucide-react";

// ===========================================================================
// Types
// ===========================================================================

interface FileSlot {
  label: string;
  key: "posiciones" | "operaciones" | "saldos";
  file: File | null;
}

export interface UploadResult {
  success: boolean;
  inserted?: {
    positions: number;
    operations: number;
    balances: number;
    newAccounts: number;
  };
  stats?: Record<string, { totalRows: number; validRows: number; skippedRows: number; errors: string[] }>;
  error?: string;
}

interface FileAnalysis {
  fileName: string;
  fileType: string;
  sheetNames: string[];
  totalRows: number;
  columns: string[];
  issues: string[];
  detectedType: string | null;
}

interface AnalysisResult {
  analyses: Record<string, FileAnalysis>;
  aiAnalysis: string;
}

interface ExcelUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
}

// ===========================================================================
// Constants
// ===========================================================================

const ACCEPTED_EXTENSIONS = ".xlsx,.xls";
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ===========================================================================
// Component
// ===========================================================================

export default function ExcelUpload({ onUploadComplete }: ExcelUploadProps) {
  const [slots, setSlots] = useState<FileSlot[]>([
    { label: "Posiciones", key: "posiciones", file: null },
    { label: "Operaciones", key: "operaciones", file: null },
    { label: "Saldos", key: "saldos", file: null },
  ]);

  const [status, setStatus] = useState<
    "idle" | "analyzing" | "reviewed" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFileChange = useCallback(
    (index: number, fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const file = fileList[0];

      const ext = file.name.toLowerCase().split(".").pop();
      if (ext !== "xlsx" && ext !== "xls") {
        setStatus("error");
        setMessage(`"${file.name}" no es un archivo Excel valido. Solo .xlsx o .xls.`);
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setStatus("error");
        setMessage(`"${file.name}" excede el limite de ${MAX_FILE_SIZE_MB}MB.`);
        return;
      }

      setSlots((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], file };
        return updated;
      });

      // Reset analysis when files change
      setAnalysis(null);
      if (status !== "idle") {
        setStatus("idle");
        setMessage("");
      }
    },
    [status]
  );

  const removeFile = useCallback((index: number) => {
    setSlots((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], file: null };
      return updated;
    });
    const input = fileInputRefs.current[index];
    if (input) input.value = "";
    setAnalysis(null);
    setStatus("idle");
    setMessage("");
  }, []);

  const hasAnyFile = slots.some((s) => s.file !== null);

  // Step 1: Analyze files
  const handleAnalyze = useCallback(async () => {
    if (!hasAnyFile) return;

    setStatus("analyzing");
    setMessage("");
    setAnalysis(null);

    try {
      const formData = new FormData();
      for (const slot of slots) {
        if (slot.file) formData.append(slot.key, slot.file);
      }

      const response = await fetch("/api/analyze-excel", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        setStatus("error");
        setMessage(err.error ?? "Error analizando archivos");
        return;
      }

      const result: AnalysisResult = await response.json();
      setAnalysis(result);
      setStatus("reviewed");
    } catch (err) {
      setStatus("error");
      setMessage("Error de conexion al analizar los archivos.");
    }
  }, [hasAnyFile, slots]);

  // Step 2: Confirm and upload
  const handleConfirmUpload = useCallback(async () => {
    if (!hasAnyFile) return;

    setStatus("loading");
    setMessage("");

    try {
      const formData = new FormData();
      for (const slot of slots) {
        if (slot.file) formData.append(slot.key, slot.file);
      }

      const response = await fetch("/api/upload-excel", {
        method: "POST",
        body: formData,
      });

      const result: UploadResult = await response.json();

      if (!response.ok || !result.success) {
        setStatus("error");
        setMessage(result.error ?? `Error del servidor (${response.status}).`);
        return;
      }

      setStatus("success");
      const p = result.inserted?.positions ?? 0;
      const o = result.inserted?.operations ?? 0;
      const s = result.inserted?.balances ?? 0;
      const n = result.inserted?.newAccounts ?? 0;
      setMessage(
        `Insertado correctamente: ${p} posiciones, ${o} operaciones, ${s} saldos. ${n} cuentas nuevas.`
      );

      onUploadComplete?.(result);
    } catch (err) {
      setStatus("error");
      setMessage("Error inesperado al procesar los archivos.");
    }
  }, [hasAnyFile, slots, onUploadComplete]);

  const hasIssues =
    analysis &&
    Object.values(analysis.analyses).some((a) => a.issues.length > 0);

  return (
    <Card className="w-full max-w-2xl border bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-rowell-navy">
          <Upload className="h-5 w-5" />
          Cargar Archivos Excel
        </CardTitle>
        <CardDescription>
          Sube los archivos Excel de Mapfre. Se analizaran antes de cargarlos.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* File Slots */}
        {slots.map((slot, index) => (
          <div key={slot.key} className="space-y-2">
            <Label htmlFor={`file-${slot.key}`} className="text-gray-700">
              {slot.label}
            </Label>
            <div className="flex items-center gap-3">
              <input
                ref={(el) => { fileInputRefs.current[index] = el; }}
                id={`file-${slot.key}`}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={(e) => handleFileChange(index, e.target.files)}
                className="hidden"
              />

              {slot.file ? (
                <div className="flex flex-1 items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-green-600" />
                  <span className="truncate text-green-800">{slot.file.name}</span>
                  <span className="shrink-0 text-xs text-green-600">
                    ({(slot.file.size / 1024).toFixed(0)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="ml-auto shrink-0 rounded p-0.5 text-green-600 hover:bg-green-100 hover:text-green-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 justify-start text-gray-500"
                  onClick={() => fileInputRefs.current[index]?.click()}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Seleccionar archivo de {slot.label}
                </Button>
              )}
            </div>
          </div>
        ))}

        {/* Step 1: Analyze Button */}
        {status === "idle" && (
          <Button
            onClick={handleAnalyze}
            disabled={!hasAnyFile}
            className="w-full gap-2"
            size="lg"
          >
            <Search className="h-4 w-4" />
            Analizar antes de cargar
          </Button>
        )}

        {/* Analyzing state */}
        {status === "analyzing" && (
          <div className="flex items-center justify-center gap-3 rounded-lg border border-[var(--color-gold-30)] bg-[var(--color-gold-10)] px-4 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--color-gold)]" />
            <div>
              <p className="text-sm font-medium text-[var(--color-primary)]">Analizando archivos...</p>
              <p className="text-xs text-gray-500">Verificando formato, columnas y datos</p>
            </div>
          </div>
        )}

        {/* Step 2: Analysis Results */}
        {status === "reviewed" && analysis && (
          <div className="space-y-4">
            {/* File summaries */}
            {Object.entries(analysis.analyses).map(([type, a]) => (
              <div
                key={type}
                className={`rounded-lg border px-4 py-3 ${
                  a.issues.length > 0
                    ? "border-amber-200 bg-amber-50"
                    : "border-green-200 bg-green-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  {a.issues.length > 0 ? (
                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
                  )}
                  <span className="text-sm font-medium text-gray-800">
                    {a.fileName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {a.totalRows} filas · {a.columns.length} columnas
                  </span>
                </div>
                {a.issues.length > 0 && (
                  <ul className="ml-6 mt-1.5 space-y-0.5">
                    {a.issues.map((issue, i) => (
                      <li key={i} className="text-xs text-amber-700">
                        ⚠️ {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {/* AI Analysis */}
            <div className="rounded-lg border border-[var(--color-primary-10)] bg-[var(--color-primary-5)] p-4">
              <div className="mb-2 flex items-center gap-2">
                <Bot className="h-4 w-4 text-[var(--color-gold)]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                  Analisis IA
                </span>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {analysis.aiAnalysis}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setAnalysis(null);
                  setStatus("idle");
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmUpload}
                className="flex-1 gap-2"
                size="lg"
              >
                <ArrowRight className="h-4 w-4" />
                {hasIssues ? "Cargar de todos modos" : "Confirmar y cargar"}
              </Button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {status === "loading" && (
          <div className="flex items-center justify-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--color-primary)]" />
            <span className="text-sm text-gray-600">Procesando y guardando en base de datos...</span>
          </div>
        )}

        {/* Status messages */}
        {message && (status === "success" || status === "error") && (
          <div
            className={`flex items-start gap-2 rounded-md p-3 text-sm ${
              status === "success"
                ? "border border-green-200 bg-green-50 text-green-800"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {status === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />}
            {status === "error" && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
            <span>{message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
