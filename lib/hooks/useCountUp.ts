"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `end` using requestAnimationFrame.
 * Respects prefers-reduced-motion — skips animation if user prefers reduced motion.
 */
export function useCountUp(end: number, duration = 1000): number {
  const [value, setValue] = useState(0);
  const prevEnd = useRef(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    // Respect prefers-reduced-motion
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(end);
      prevEnd.current = end;
      return;
    }

    const start = prevEnd.current;
    const diff = end - start;
    if (diff === 0) return;

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + diff * eased);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setValue(end);
        prevEnd.current = end;
      }
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameRef.current);
  }, [end, duration]);

  return value;
}
