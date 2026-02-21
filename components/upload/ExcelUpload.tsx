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
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";

// ===========================================================================
// Tipos
// ===========================================================================

interface FileSlot {
  label: string;
  key: "posiciones" | "operaciones" | "liquidez";
  file: File | null;
}

export interface UploadResult {
  success: boolean;
  data?: {
    positions: unknown[];
    operations: unknown[];
    liquidity: unknown[];
  };
  stats?: {
    positions: { totalRows: number; validRows: number; skippedRows: number; errors: string[] };
    operations: { totalRows: number; validRows: number; skippedRows: number; errors: string[] };
    liquidity: { totalRows: number; validRows: number; skippedRows: number; errors: string[] };
  };
  error?: string;
}

interface ExcelUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
}

// ===========================================================================
// Constantes
// ===========================================================================

const ACCEPTED_EXTENSIONS = ".xlsx,.xls";
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ===========================================================================
// Componente
// ===========================================================================

export default function ExcelUpload({ onUploadComplete }: ExcelUploadProps) {
  const [slots, setSlots] = useState<FileSlot[]>([
    { label: "Posiciones", key: "posiciones", file: null },
    { label: "Operaciones", key: "operaciones", file: null },
    { label: "Liquidez", key: "liquidez", file: null },
  ]);

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFileChange = useCallback(
    (index: number, fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const file = fileList[0];

      // Validar extension
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext !== "xlsx" && ext !== "xls") {
        setStatus("error");
        setMessage(`"${file.name}" no es un archivo Excel valido. Solo .xlsx o .xls.`);
        return;
      }

      // Validar tamano
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setStatus("error");
        setMessage(
          `"${file.name}" excede el limite de ${MAX_FILE_SIZE_MB}MB (${(file.size / 1024 / 1024).toFixed(1)}MB).`
        );
        return;
      }

      setSlots((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], file };
        return updated;
      });

      // Limpiar errores previos
      if (status === "error") {
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
    // Reset the file input
    const input = fileInputRefs.current[index];
    if (input) input.value = "";
  }, []);

  const hasAnyFile = slots.some((s) => s.file !== null);

  const handleSubmit = useCallback(async () => {
    if (!hasAnyFile) {
      setStatus("error");
      setMessage("Selecciona al menos un archivo Excel para procesar.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const formData = new FormData();

      for (const slot of slots) {
        if (slot.file) {
          formData.append(slot.key, slot.file);
        }
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

      const posCount = result.stats?.positions.validRows ?? 0;
      const opsCount = result.stats?.operations.validRows ?? 0;
      const liqCount = result.stats?.liquidity.validRows ?? 0;

      setMessage(
        `Procesado correctamente: ${posCount} posiciones, ${opsCount} operaciones, ${liqCount} movimientos de liquidez.`
      );

      onUploadComplete?.(result);
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error
          ? `Error de conexion: ${err.message}`
          : "Error inesperado al procesar los archivos."
      );
    }
  }, [hasAnyFile, slots, onUploadComplete]);

  return (
    <Card className="w-full max-w-2xl border bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#1e3a8a]">
          <Upload className="h-5 w-5" />
          Cargar Archivos Excel
        </CardTitle>
        <CardDescription>
          Sube los archivos Excel de Mapfre para procesar tu cartera.
          Formatos aceptados: .xlsx, .xls (max {MAX_FILE_SIZE_MB}MB cada uno).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* --- File Slots --- */}
        {slots.map((slot, index) => (
          <div key={slot.key} className="space-y-2">
            <Label htmlFor={`file-${slot.key}`} className="text-gray-700">
              {slot.label}
            </Label>
            <div className="flex items-center gap-3">
              <input
                ref={(el) => {
                  fileInputRefs.current[index] = el;
                }}
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
                    aria-label={`Quitar ${slot.file.name}`}
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

        {/* --- Submit Button --- */}
        <Button
          onClick={handleSubmit}
          disabled={!hasAnyFile || status === "loading"}
          className="w-full"
          size="lg"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Procesar Excel
            </>
          )}
        </Button>

        {/* --- Status Message --- */}
        {message && (
          <div
            className={`flex items-start gap-2 rounded-md p-3 text-sm ${
              status === "success"
                ? "border border-green-200 bg-green-50 text-green-800"
                : status === "error"
                  ? "border border-red-200 bg-red-50 text-red-800"
                  : ""
            }`}
          >
            {status === "success" && (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            )}
            {status === "error" && (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            )}
            <span>{message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
