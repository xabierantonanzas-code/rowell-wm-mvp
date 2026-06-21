"use client";

// ===========================================================================
// CarteraV2Picker — selector de cliente para "Evolución de cartera".
//
// Reproduce el markup/estilo del sub-componente ClientDropdown de
// AdminDashboard (tarjeta trigger + panel con buscador + lista de clientes),
// pero OMITE la opción "Todos los clientes": aquí siempre hay que elegir UNO.
//
// Al seleccionar un cliente navega a /cartera-v2?client=<id> (mismo patrón
// que AdminDashboard.handleClientChange → window.location.href).
// ===========================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Users } from "lucide-react";

interface ClientInfo {
  id: string;
  name: string;
  accounts: { id: string; account_number: string; label: string | null }[];
}

interface CarteraV2PickerProps {
  clients: ClientInfo[];
  selectedClientId?: string;
}

export default function CarteraV2Picker({
  clients,
  selectedClientId,
}: CarteraV2PickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.accounts.some((a) => a.account_number.includes(q))
    );
  }, [clients, searchQuery]);

  const selectedClient = selectedClientId
    ? clients.find((c) => c.id === selectedClientId)
    : undefined;

  const selectedName = selectedClient?.name ?? "Selecciona un cliente";
  const selectedAccounts = selectedClient?.accounts.length ?? 0;

  const handleSelect = (id: string) => {
    window.location.href = "/cartera-v2?client=" + id;
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(!open); setSearchQuery(""); }}
        className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-all hover:border-[var(--color-gold-50)] hover:shadow-md"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary-5)]">
            <Users className="h-4 w-4 text-[var(--color-primary)]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[var(--color-primary)]">{selectedName}</p>
            <p className="text-xs text-gray-400">
              {selectedClient
                ? `${selectedAccounts} cartera${selectedAccounts !== 1 ? "s" : ""} · ${clients.length} clientes total`
                : `${clients.length} clientes`}
            </p>
          </div>
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {/* Search input */}
          <div className="border-b border-gray-100 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar por nombre, alias o cuenta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-[var(--color-gold)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-gold)]"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-[70vh] overflow-y-auto scrollbar-thin">
            {filteredClients.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">
                No se encontraron clientes
              </p>
            ) : (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => { handleSelect(client.id); setOpen(false); }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-bg)] ${
                    selectedClientId === client.id ? "bg-[var(--color-primary-5)]" : ""
                  }`}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-5)] text-xs font-semibold text-[var(--color-primary)]">
                    {client.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {client.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {client.accounts.length} cartera{client.accounts.length !== 1 ? "s" : ""}
                      {client.accounts[0]?.label ? ` · ${client.accounts[0].label}` : ""}
                    </p>
                  </div>
                  {selectedClientId === client.id && (
                    <div className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--color-gold)]" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
