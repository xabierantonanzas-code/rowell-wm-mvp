"use client";

import { useCountUp } from "@/lib/hooks/useCountUp";

type FormatFn = (value: number) => string;

interface AnimatedValueProps {
  value: number;
  format?: FormatFn;
  prefix?: string;
  suffix?: string;
  duration?: number;
}

const defaultFormat: FormatFn = (v) =>
  v.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export function AnimatedValue({
  value,
  format = defaultFormat,
  prefix = "",
  suffix = "",
  duration = 500,
}: AnimatedValueProps) {
  const animated = useCountUp(value, duration);
  return (
    <>
      {prefix}
      {format(animated)}
      {suffix}
    </>
  );
}

/** Pre-built format helpers */
export const formatters = {
  eur: (v: number) =>
    v.toLocaleString("es-ES", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }),
  eur2: (v: number) =>
    v.toLocaleString("es-ES", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  pct: (v: number) => `${v.toFixed(1)}%`,
  pct2: (v: number) => `${v.toFixed(2)}%`,
  integer: (v: number) => String(Math.round(v)),
};
