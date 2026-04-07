"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo, useRef } from "react";
import { Calendar, Briefcase } from "lucide-react";

// ===========================================================================
// Selector de Rango de Fechas (MVP6 puntos 3 y 4)
// ===========================================================================
//
// - Fix iOS Safari: el input nativo type="date" en iOS Safari a veces no
//   se abre al tocar el campo si esta dentro de un wrapper o tiene -webkit-
//   appearance:none. Solucion: forzamos `appearance: auto`, eliminamos
//   min-width problematicos y abrimos el picker programaticamente con
//   showPicker() en el onClick para iOS y desktop.
//
// - Botones rapidos: 1M, YTD, 1A, Desde origen. La fecha "Desde origen"
//   requiere conocer la 1ª operacion de la CV; se pasa por prop.

interface DateRangeSelectorProps {
  dateFrom?: string;
  dateTo?: string;
  /** Fecha de la 1a operacion registrada para esta CV (YYYY-MM-DD). Si se
   * omite, el boton "Desde origen" no se muestra. */
  originDate?: string | null;
  onDateChange?: (dateFrom: string | undefined, dateTo: string | undefined) => void;
}

const todayIso = () => new Date().toISOString().split("T")[0];

const minusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
};

const yearStartIso = () => `${new Date().getFullYear()}-01-01`;

export function DateRangeSelector({
  dateFrom,
  dateTo,
  originDate,
  onDateChange,
}: DateRangeSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  const setDateRange = useCallback(
    (from: string | undefined, to: string | undefined) => {
      if (onDateChange) {
        onDateChange(from, to);
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      if (from) params.set("dateFrom", from);
      else params.delete("dateFrom");
      if (to) params.set("dateTo", to);
      else params.delete("dateTo");
      params.delete("year");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, onDateChange]
  );

  const clearRange = () => setDateRange(undefined, undefined);

  // Periodos preconfigurados (Edgard MVP6 punto 4)
  const periods = useMemo(
    () => [
      { label: "1M", from: minusDays(30), to: todayIso() },
      { label: "YTD", from: yearStartIso(), to: todayIso() },
      { label: "1A", from: minusDays(365), to: todayIso() },
      ...(originDate
        ? [{ label: "Origen", from: originDate, to: todayIso() }]
        : []),
    ],
    [originDate]
  );

  // Detecta si el periodo activo coincide con un boton (para resaltarlo)
  const activeLabel = useMemo(() => {
    if (!dateFrom && !dateTo) return null;
    for (const p of periods) {
      if (p.from === dateFrom && p.to === dateTo) return p.label;
    }
    return null;
  }, [dateFrom, dateTo, periods]);

  // Helper: abrir picker nativo en iOS Safari y desktop
  const openPicker = (ref: React.RefObject<HTMLInputElement>) => {
    const el = ref.current;
    if (!el) return;
    // showPicker() es la API moderna; algunos iOS antiguos solo responden a focus()
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        /* fall through */
      }
    }
    el.focus();
    el.click();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Calendar className="h-4 w-4 text-gray-400" />
      {/* Botones de periodo */}
      <div className="flex items-center gap-1">
        {periods.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setDateRange(p.from, p.to)}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              activeLabel === p.label
                ? "border-[#B8965A] bg-[#B8965A] text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-[#B8965A] hover:text-[#3D4F63]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Inputs de fecha (fix iOS Safari: showPicker + appearance auto) */}
      <div className="flex items-center gap-1.5">
        <input
          ref={fromRef}
          type="date"
          value={dateFrom ?? ""}
          onChange={(e) => setDateRange(e.target.value || undefined, dateTo)}
          onClick={() => openPicker(fromRef)}
          style={{ WebkitAppearance: "auto" as any, appearance: "auto" as any }}
          className="min-w-[130px] cursor-pointer rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 shadow-sm focus:border-rowell-navy focus:outline-none focus:ring-1 focus:ring-rowell-navy"
          aria-label="Fecha desde"
        />
        <span className="text-xs text-gray-400">—</span>
        <input
          ref={toRef}
          type="date"
          value={dateTo ?? ""}
          onChange={(e) => setDateRange(dateFrom, e.target.value || undefined)}
          onClick={() => openPicker(toRef)}
          style={{ WebkitAppearance: "auto" as any, appearance: "auto" as any }}
          className="min-w-[130px] cursor-pointer rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 shadow-sm focus:border-rowell-navy focus:outline-none focus:ring-1 focus:ring-rowell-navy"
          aria-label="Fecha hasta"
        />
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={clearRange}
            className="rounded-md bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-200"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Selector de Cartera / Cuenta
// ===========================================================================

interface AccountOption {
  id: string;
  account_number: string;
  label: string | null;
}

interface AccountSelectorProps {
  accounts: AccountOption[];
  currentAccountId?: string;
  showAll?: boolean;
}

export function AccountSelector({
  accounts,
  currentAccountId,
  showAll = true,
}: AccountSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setAccount = useCallback(
    (accountId: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (accountId) {
        params.set("account", accountId);
      } else {
        params.delete("account");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  if (accounts.length <= 1 && !showAll) return null;

  return (
    <div className="flex items-center gap-2">
      <Briefcase className="h-4 w-4 text-gray-400" />
      <select
        value={currentAccountId ?? "all"}
        onChange={(e) =>
          setAccount(e.target.value === "all" ? undefined : e.target.value)
        }
        className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm focus:border-rowell-navy focus:outline-none focus:ring-1 focus:ring-rowell-navy"
      >
        {showAll && accounts.length > 1 && (
          <option value="all">Todas las carteras</option>
        )}
        {accounts.map((acc) => (
          <option key={acc.id} value={acc.id}>
            ...{acc.account_number.slice(-8)}
            {acc.label ? ` - ${acc.label}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
