"use client";

import { useEffect, useRef, useCallback } from "react";

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

/**
 * Renders an animated count-up number using direct DOM updates (no React re-renders).
 * Uses requestAnimationFrame + ref for zero React overhead.
 */
export function AnimatedValue({
  value,
  format = defaultFormat,
  prefix = "",
  suffix = "",
  duration = 1000,
}: AnimatedValueProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(0);
  const frameRef = useRef<number>(0);

  const updateText = useCallback(
    (v: number) => {
      if (spanRef.current) {
        spanRef.current.textContent = `${prefix}${format(v)}${suffix}`;
      }
    },
    [format, prefix, suffix]
  );

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    // Respect prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      updateText(value);
      prevValue.current = value;
      return;
    }

    const start = prevValue.current;
    const diff = value - start;
    if (diff === 0) {
      updateText(value);
      return;
    }

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      updateText(start + diff * eased);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        updateText(value);
        prevValue.current = value;
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration, updateText]);

  // Initial render with the starting value (0 or previous)
  return (
    <span ref={spanRef}>
      {`${prefix}${format(prevValue.current)}${suffix}`}
    </span>
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
