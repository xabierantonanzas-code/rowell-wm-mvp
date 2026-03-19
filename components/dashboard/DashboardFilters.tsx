"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Calendar, Briefcase } from "lucide-react";

// ===========================================================================
// Selector de Ano
// ===========================================================================

interface YearSelectorProps {
  years: number[];
  currentYear?: number;
}

export function YearSelector({ years, currentYear }: YearSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setYear = useCallback(
    (year: number | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (year) {
        params.set("year", String(year));
      } else {
        params.delete("year");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-gray-400" />
      <div className="flex gap-1">
        <button
          onClick={() => setYear(undefined)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            !currentYear
              ? "bg-rowell-navy text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Todo
        </button>
        {years.map((year) => (
          <button
            key={year}
            onClick={() => setYear(year)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              currentYear === year
                ? "bg-rowell-navy text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {year}
          </button>
        ))}
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
