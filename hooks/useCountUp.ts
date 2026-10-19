"use client";

import { useEffect, useState } from "react";

/** Counts from 0 up to `target` (one decimal) over `ms`. Jumps straight to the value if the person prefers reduced motion. */
export function useCountUp(target: number, ms = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || ms <= 0) {
      setValue(target);
      return;
    }
    let frame = 0;
    let start: number | null = null; // taken from the first frame's own timestamp, so the clocks always agree
    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.max(0, Math.min(1, (now - start) / ms));
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(Math.round(target * eased * 10) / 10);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}
