"use client";

import { useState, useRef, useEffect } from "react";
import { X, Search, Loader2, Mail, Check } from "lucide-react";

interface ClientOption {
  id: string;
  name: string;
  email: string | null;
  hasAccess: boolean; // true if auth_user_id is set or has pending invitation
  inviteStatus: "none" | "pending" | "confirmed";
}

interface InviteClientModalProps {
  open: boolean;
  onClose: () => void;
  clients: ClientOption[];
}

export default function InviteClientModal({
  open,
  onClose,
  clients,
}: InviteClientModalProps) {
  const [email, setEmail] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setEmail("");
      setSelectedClient(null);
      setSearchQuery("");
      setStatus("idle");
      setMessage("");
      setShowDropdown(false);
    }
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredClients = clients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const handleSelectClient = (client: ClientOption) => {
    setSelectedClient(client);
    setSearchQuery(client.name);
    setShowDropdown(false);
    // Pre-fill email if client has one
    if (client.email) setEmail(client.email);
  };

  const handleInvite = async () => {
    if (!selectedClient || !email) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          client_id: selectedClient.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Error enviando invitacion");
        return;
      }

      setStatus("success");
      setMessage(data.message ?? `Invitacion enviada a ${email}`);
    } catch {
      setStatus("error");
      setMessage("Error de conexion");
    }
  };

  if (!open) return null;

  const canInvite =
    selectedClient &&
    email.trim() &&
    selectedClient.inviteStatus === "none" &&
    status !== "loading" &&
    status !== "success";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#B8965A]" />
            <h2 className="text-lg font-semibold text-[#3D4F63]">
              Invitar Cliente
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-5">
          {/* Client selector */}
          <div ref={dropdownRef} className="relative">
            <label className="mb-1.5 block text-sm font-medium text-[#3D4F63]">
              Cliente
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar por nombre..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  if (selectedClient) setSelectedClient(null);
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#B8965A] focus:ring-2 focus:ring-[#B8965A]/20"
              />
            </div>

            {showDropdown && (
              <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {filteredClients.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400">
                    No se encontraron clientes
                  </p>
                ) : (
                  filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-[#F5F5F5]"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {client.name}
                        </p>
                        {client.email && (
                          <p className="text-xs text-gray-400">{client.email}</p>
                        )}
                      </div>
                      <StatusBadge status={client.inviteStatus} />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected client status */}
          {selectedClient && selectedClient.inviteStatus !== "none" && (
            <div className={`rounded-lg px-4 py-3 text-sm ${
              selectedClient.inviteStatus === "confirmed"
                ? "border border-green-200 bg-green-50 text-green-700"
                : "border border-amber-200 bg-amber-50 text-amber-700"
            }`}>
              {selectedClient.inviteStatus === "confirmed"
                ? "Este cliente ya tiene acceso activo."
                : "Este cliente ya tiene una invitacion pendiente."}
            </div>
          )}

          {/* Email input */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#3D4F63]">
              Email del cliente
            </label>
            <input
              type="email"
              placeholder="cliente@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#B8965A] focus:ring-2 focus:ring-[#B8965A]/20"
            />
          </div>

          {/* Status messages */}
          {status === "success" && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <Check className="h-4 w-4 flex-shrink-0" />
              {message}
            </div>
          )}
          {status === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
          >
            {status === "success" ? "Cerrar" : "Cancelar"}
          </button>
          {status !== "success" && (
            <button
              onClick={handleInvite}
              disabled={!canInvite}
              className="flex items-center gap-2 rounded-lg bg-[#3D4F63] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3D4F63] disabled:opacity-40"
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Enviar invitacion
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "none" | "pending" | "confirmed" }) {
  if (status === "confirmed") {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
        Activo
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
        Invitado
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
      Sin invitar
    </span>
  );
}
