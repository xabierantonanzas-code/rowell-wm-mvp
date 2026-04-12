"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import ExcelUpload from "@/components/upload/ExcelUpload";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  Upload,
  FileText,
  Search,
  Loader2,
  X,
  Users,
} from "lucide-react";
import type { DocType } from "@/lib/types/database";

export default function UploadPage() {
  const router = useRouter();
  const { isAdmin, loading } = useUser();
  const [result, setResult] = useState<{
    success: boolean;
    inserted?: {
      positions: number;
      operations: number;
      balances: number;
      newAccounts: number;
    };
    stats?: Record<string, { totalRows: number; validRows: number; skippedRows: number }>;
    error?: string;
  } | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400">Cargando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-rowell-navy">
            Upload
          </h1>
        </div>
        <Card className="border bg-white shadow-sm">
          <CardContent className="flex items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-6 w-6 text-amber-500" />
            <p className="text-gray-500">
              Solo el administrador puede subir archivos.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-rowell-navy">
          Cargar Datos
        </h1>
        <p className="mt-1 text-gray-500">
          Sube archivos Excel de Mapfre o documentos para clientes
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-8">
        {/* Excel Upload */}
        <ExcelUpload onUploadComplete={(r) => setResult(r)} />

        {/* Results */}
        {result?.success && result.inserted && (
          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rowell-navy">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Datos cargados correctamente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatBlock
                  label="Posiciones"
                  value={result.inserted.positions}
                />
                <StatBlock
                  label="Operaciones"
                  value={result.inserted.operations}
                />
                <StatBlock
                  label="Saldos"
                  value={result.inserted.balances}
                />
                <StatBlock
                  label="Cuentas nuevas"
                  value={result.inserted.newAccounts}
                />
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  size="lg"
                  onClick={() => router.push("/admin")}
                  className="gap-2"
                >
                  Ver Panel Admin
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {result && !result.success && (
          <Card className="border border-red-200 bg-red-50 shadow-sm">
            <CardContent className="py-4 text-sm text-red-700">
              {result.error ?? "Error desconocido al procesar los archivos."}
            </CardContent>
          </Card>
        )}

        {/* Document Upload */}
        <DocumentUploadSection />
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3 text-center">
      <p className="text-2xl font-bold text-rowell-navy">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{label}</p>
    </div>
  );
}

// ===========================================================================
// Document Upload Section
// ===========================================================================

interface ClientOption {
  id: string;
  full_name: string;
  alias: string | null;
}

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "informe", label: "Informe" },
  { value: "contrato", label: "Contrato" },
  { value: "minuta", label: "Minuta" },
  { value: "otro", label: "Otro" },
];

function DocumentUploadSection() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<string | "">("");
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState<DocType>("informe");
  const [docDescription, setDocDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch clients
  useEffect(() => {
    async function fetchClients() {
      const supabase = createClient();
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, alias")
        .order("full_name");
      setClients((data ?? []) as ClientOption[]);
      setLoadingClients(false);
    }
    fetchClients();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredClients = clients.filter((c) => {
    if (!clientSearch.trim()) return true;
    const q = clientSearch.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      (c.alias && c.alias.toLowerCase().includes(q))
    );
  });

  const selectedClientName = selectedClientId
    ? clients.find((c) => c.id === selectedClientId)?.full_name ?? ""
    : "";

  const handleUpload = async () => {
    if (!file || !docName.trim() || !selectedClientId) return;
    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("client_id", selectedClientId);
      formData.append("name", docName.trim());
      formData.append("doc_type", docType);
      if (docDescription.trim()) {
        formData.append("description", docDescription.trim());
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setUploadResult({ success: true, message: `"${docName}" subido correctamente para ${selectedClientName}` });
        setDocName("");
        setDocDescription("");
        setFile(null);
      } else {
        const err = await res.json();
        setUploadResult({ success: false, message: err.error ?? "Error subiendo documento" });
      }
    } catch (err) {
      setUploadResult({ success: false, message: "Error de conexion" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[var(--color-primary)]">
          <FileText className="h-5 w-5 text-[var(--color-gold)]" />
          Subir Documentos a Clientes
        </CardTitle>
        <p className="text-sm text-gray-400">
          Sube informes, contratos u otros documentos asignados a un cliente
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Client selector */}
        <div ref={dropdownRef} className="relative">
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Cliente
          </label>
          <button
            onClick={() => { setShowClientDropdown(!showClientDropdown); setClientSearch(""); }}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-left text-sm transition-colors hover:border-[var(--color-gold)]/50"
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <span className={selectedClientId ? "text-gray-800" : "text-gray-400"}>
                {selectedClientId ? selectedClientName : "Selecciona un cliente..."}
              </span>
            </div>
            <svg
              className={`h-4 w-4 text-gray-400 transition-transform ${showClientDropdown ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showClientDropdown && (
            <div className="absolute left-0 right-0 z-50 mt-1 max-h-[300px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
              <div className="border-b border-gray-100 p-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-[var(--color-gold)] focus:bg-white focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-[240px] overflow-y-auto">
                {loadingClients ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                ) : filteredClients.length === 0 ? (
                  <p className="px-4 py-4 text-center text-sm text-gray-400">No se encontraron clientes</p>
                ) : (
                  filteredClients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedClientId(c.id);
                        setShowClientDropdown(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-[#F5F5F5] ${
                        selectedClientId === c.id ? "bg-[var(--color-primary-5)]" : ""
                      }`}
                    >
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-5)] text-[10px] font-semibold text-[var(--color-primary)]">
                        {c.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="truncate text-gray-700">{c.full_name}</span>
                      {selectedClientId === c.id && (
                        <div className="ml-auto h-2 w-2 rounded-full bg-[var(--color-gold)]" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Document details */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Nombre del documento</label>
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="Informe Q1 2026..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[var(--color-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-gold)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Tipo</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[var(--color-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-gold)]"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Descripcion (opcional)</label>
          <input
            type="text"
            value={docDescription}
            onChange={(e) => setDocDescription(e.target.value)}
            placeholder="Descripcion breve..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[var(--color-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-gold)]"
          />
        </div>

        {/* File picker */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-8 text-sm text-gray-400 transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
        >
          <Upload className="h-5 w-5" />
          {file ? (
            <span className="font-medium text-gray-600">{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
          ) : (
            "Haz clic para seleccionar archivo"
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={uploading || !file || !docName.trim() || !selectedClientId}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? "Subiendo..." : "Subir documento"}
        </button>

        {/* Result */}
        {uploadResult && (
          <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            uploadResult.success
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}>
            {uploadResult.success ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <X className="h-4 w-4 flex-shrink-0" />
            )}
            {uploadResult.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
