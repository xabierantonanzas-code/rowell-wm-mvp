"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Calendar, Briefcase } from "lucide-react";

// ===========================================================================
// Selector de Rango de Fechas
// ===========================================================================

interface DateRangeSelectorProps {
  dateFrom?: string;
  dateTo?: string;
  onDateChange?: (dateFrom: string | undefined, dateTo: string | undefined) => void;
}

export function DateRangeSelector({
  dateFrom,
  dateTo,
  onDateChange,
}: DateRangeSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setDateRange = useCallback(
    (from: string | undefined, to: string | undefined) => {
      if (onDateChange) {
        onDateChange(from, to);
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      if (from) {
        params.set("dateFrom", from);
      } else {
        params.delete("dateFrom");
      }
      if (to) {
        params.set("dateTo", to);
      } else {
        params.delete("dateTo");
      }
      params.delete("year");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, onDateChange]
  );

  const clearRange = () => setDateRange(undefined, undefined);

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-gray-400" />
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={dateFrom ?? ""}
          onChange={(e) => setDateRange(e.target.value || undefined, dateTo)}
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 shadow-sm focus:border-rowell-navy focus:outline-none focus:ring-1 focus:ring-rowell-navy"
        />
        <span className="text-xs text-gray-400">—</span>
        <input
          type="date"
          value={dateTo ?? ""}
          onChange={(e) => setDateRange(dateFrom, e.target.value || undefined)}
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 shadow-sm focus:border-rowell-navy focus:outline-none focus:ring-1 focus:ring-rowell-navy"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={clearRange}
            className="rounded-md bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-200 transition-colors"
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
