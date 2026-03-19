"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Meeting, Message, Document, DocType } from "@/lib/types/database";
import {
  Calendar,
  FileText,
  MessageSquare,
  Plus,
  Download,
  Send,
  Loader2,
  Upload,
  X,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ===========================================================================
// Types
// ===========================================================================

interface CommunicationPanelProps {
  clientId: string;
  clientName: string;
  isAdmin: boolean;
}

type Tab = "reuniones" | "mensajes" | "documentos";

type DocumentWithUrl = Document & { signed_url: string | null };

// ===========================================================================
// Helpers
// ===========================================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  minuta: "Minuta",
  informe: "Informe",
  contrato: "Contrato",
  otro: "Otro",
};

// ===========================================================================
// Sub-component: Meeting Card
// ===========================================================================

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-l-4 border-[#C9A84C] p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-400">
                {formatDate(meeting.meeting_date)}
              </span>
            </div>
            <h4 className="mt-1 font-semibold text-[#0B1D3A]">
              {meeting.title}
            </h4>
          </div>
          <div className="flex items-center gap-2">
            {meeting.pdf_url && (
              <a
                href={meeting.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-md bg-[#0B1D3A] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0B1D3A]/80"
              >
                <Download className="h-3 w-3" />
                PDF
              </a>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {meeting.summary && (
          <p className="mt-2 text-sm text-gray-500">{meeting.summary}</p>
        )}

        {expanded && (
          <div className="mt-4 space-y-3">
            {meeting.key_points && meeting.key_points.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Puntos clave
                </p>
                <ul className="mt-1 space-y-1">
                  {meeting.key_points.map((point, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-gray-600"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#C9A84C]" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {meeting.agreed_actions && meeting.agreed_actions.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Acciones acordadas
                </p>
                <ul className="mt-1 space-y-1">
                  {meeting.agreed_actions.map((action, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-sm text-gray-600"
                    >
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[#C9A84C]" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {meeting.next_meeting_date && (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#C9A84C]/10 px-3 py-1 text-xs font-medium text-[#C9A84C]">
                  Proxima reunion: {formatDate(meeting.next_meeting_date)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-component: New Meeting Form (admin only)
// ===========================================================================

function NewMeetingForm({
  clientId,
  onCreated,
  onCancel,
}: {
  clientId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [summary, setSummary] = useState("");
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [newKeyPoint, setNewKeyPoint] = useState("");
  const [agreedActions, setAgreedActions] = useState<string[]>([]);
  const [newAction, setNewAction] = useState("");
  const [nextMeetingDate, setNextMeetingDate] = useState("");
  const [saving, setSaving] = useState(false);

  const addKeyPoint = () => {
    if (newKeyPoint.trim()) {
      setKeyPoints([...keyPoints, newKeyPoint.trim()]);
      setNewKeyPoint("");
    }
  };

  const addAction = () => {
    if (newAction.trim()) {
      setAgreedActions([...agreedActions, newAction.trim()]);
      setNewAction("");
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !meetingDate) return;
    setSaving(true);
    try {
      await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          title: title.trim(),
          meeting_date: meetingDate,
          summary: summary.trim() || null,
          key_points: keyPoints.length > 0 ? keyPoints : null,
          agreed_actions: agreedActions.length > 0 ? agreedActions : null,
          next_meeting_date: nextMeetingDate || null,
        }),
      });
      onCreated();
    } catch (err) {
      console.error("Error creating meeting:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-[#C9A84C]/30 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="font-semibold text-[#0B1D3A]">Nueva Reunion</h4>
        <button
          onClick={onCancel}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Titulo
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Revision trimestral..."
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Fecha
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Resumen
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="Resumen de la reunion..."
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
          />
        </div>

        {/* Key points */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Puntos clave
          </label>
          {keyPoints.map((kp, i) => (
            <div
              key={i}
              className="mb-1 flex items-center gap-2 text-sm text-gray-600"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#C9A84C]" />
              {kp}
              <button
                onClick={() =>
                  setKeyPoints(keyPoints.filter((_, idx) => idx !== i))
                }
                className="ml-auto text-gray-300 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyPoint}
              onChange={(e) => setNewKeyPoint(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addKeyPoint()}
              placeholder="Añadir punto..."
              className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-[#C9A84C] focus:outline-none"
            />
            <button
              onClick={addKeyPoint}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Agreed actions */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Acciones acordadas
          </label>
          {agreedActions.map((action, i) => (
            <div
              key={i}
              className="mb-1 flex items-center gap-2 text-sm text-gray-600"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-[#C9A84C]" />
              {action}
              <button
                onClick={() =>
                  setAgreedActions(agreedActions.filter((_, idx) => idx !== i))
                }
                className="ml-auto text-gray-300 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAction()}
              placeholder="Añadir accion..."
              className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-[#C9A84C] focus:outline-none"
            />
            <button
              onClick={addAction}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Proxima reunion
          </label>
          <input
            type="date"
            value={nextMeetingDate}
            onChange={(e) => setNextMeetingDate(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B1D3A] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0B1D3A]/90 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {saving ? "Guardando y generando PDF..." : "Guardar y generar PDF"}
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-component: Messages Chat
// ===========================================================================

function MessagesChat({
  clientId,
  isAdmin,
}: {
  clientId: string;
  isAdmin: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?clientId=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchMessages();
    // Mark as read
    fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId }),
    }).catch(() => {});
  }, [clientId, fetchMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMsg.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          content: newMsg.trim(),
          is_from_advisor: isAdmin,
        }),
      });
      if (res.ok) {
        setNewMsg("");
        await fetchMessages();
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-[500px] flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Messages area */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            No hay mensajes aun. Inicia la conversacion.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.is_from_advisor ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                  msg.is_from_advisor
                    ? "bg-[#0B1D3A] text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <div
                  className={`mt-1 flex items-center gap-2 text-[10px] ${
                    msg.is_from_advisor ? "text-white/50" : "text-gray-400"
                  }`}
                >
                  <span>{formatTime(msg.created_at)}</span>
                  {!msg.is_from_advisor && !msg.read_at && (
                    <span className="rounded-full bg-[#C9A84C] px-1.5 py-0.5 text-[9px] font-bold text-white">
                      Nuevo
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Escribe un mensaje..."
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
          />
          <button
            onClick={handleSend}
            disabled={sending || !newMsg.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C9A84C] text-white transition-colors hover:bg-[#b8993f] disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-component: Documents Grid
// ===========================================================================

function DocumentsGrid({
  clientId,
  isAdmin,
}: {
  clientId: string;
  isAdmin: boolean;
}) {
  const [docs, setDocs] = useState<DocumentWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState<DocType>("otro");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents?clientId=${clientId}`);
      if (res.ok) {
        setDocs(await res.json());
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim() || uploading) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("client_id", clientId);
      formData.append("name", uploadName.trim());
      formData.append("doc_type", uploadType);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setShowUpload(false);
        setUploadName("");
        setUploadFile(null);
        setUploadType("otro");
        await fetchDocs();
      }
    } catch (err) {
      console.error("Error uploading document:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (url: string) => {
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && !showUpload && (
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 rounded-lg bg-[#0B1D3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0B1D3A]/90"
        >
          <Upload className="h-4 w-4" />
          Subir documento
        </button>
      )}

      {showUpload && (
        <div className="rounded-lg border border-[#C9A84C]/30 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#0B1D3A]">
              Subir documento
            </h4>
            <button
              onClick={() => setShowUpload(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="Nombre del documento"
                className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-[#C9A84C] focus:outline-none"
              />
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as DocType)}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-[#C9A84C] focus:outline-none"
              >
                <option value="informe">Informe</option>
                <option value="contrato">Contrato</option>
                <option value="minuta">Minuta</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-200 py-6 text-sm text-gray-400 transition-colors hover:border-[#C9A84C] hover:text-[#C9A84C]"
            >
              <Upload className="h-4 w-4" />
              {uploadFile ? uploadFile.name : "Haz clic para seleccionar archivo"}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={handleUpload}
              disabled={uploading || !uploadFile || !uploadName.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b8993f] disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Subiendo..." : "Subir"}
            </button>
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          No hay documentos disponibles.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#0B1D3A]/5">
                  <FileText className="h-5 w-5 text-[#0B1D3A]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {doc.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    <span className="rounded bg-[#C9A84C]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#C9A84C]">
                      {DOC_TYPE_LABELS[doc.doc_type]}
                    </span>
                    <span>{formatFileSize(doc.file_size)}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {formatDate(doc.created_at)}
                  </p>
                </div>
              </div>
              {doc.signed_url && (
                <button
                  onClick={() => handleDownload(doc.signed_url!)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-[#C9A84C] hover:text-[#C9A84C]"
                >
                  <Download className="h-3 w-3" />
                  Descargar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Main Component
// ===========================================================================

export default function CommunicationPanel({
  clientId,
  clientName,
  isAdmin,
}: CommunicationPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("reuniones");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [showNewMeeting, setShowNewMeeting] = useState(false);

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings?clientId=${clientId}`);
      if (res.ok) {
        setMeetings(await res.json());
      }
    } catch (err) {
      console.error("Error fetching meetings:", err);
    } finally {
      setLoadingMeetings(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const tabs: { key: Tab; label: string; icon: typeof Calendar }[] = [
    { key: "reuniones", label: "Reuniones", icon: Calendar },
    { key: "mensajes", label: "Mensajes", icon: MessageSquare },
    { key: "documentos", label: "Documentos", icon: FileText },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-white text-[#0B1D3A] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "reuniones" && (
        <div className="space-y-4">
          {isAdmin && !showNewMeeting && (
            <button
              onClick={() => setShowNewMeeting(true)}
              className="flex items-center gap-2 rounded-lg bg-[#0B1D3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0B1D3A]/90"
            >
              <Plus className="h-4 w-4" />
              Nueva reunion
            </button>
          )}

          {showNewMeeting && (
            <NewMeetingForm
              clientId={clientId}
              onCreated={() => {
                setShowNewMeeting(false);
                fetchMeetings();
              }}
              onCancel={() => setShowNewMeeting(false)}
            />
          )}

          {loadingMeetings ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : meetings.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No hay reuniones registradas.
            </p>
          ) : (
            meetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))
          )}
        </div>
      )}

      {activeTab === "mensajes" && (
        <MessagesChat clientId={clientId} isAdmin={isAdmin} />
      )}

      {activeTab === "documentos" && (
        <DocumentsGrid clientId={clientId} isAdmin={isAdmin} />
      )}
    </div>
  );
}
