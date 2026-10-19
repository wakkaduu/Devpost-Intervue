"use client";

import { useEffect, useState } from "react";
import { useCountUp } from "@/hooks/useCountUp";
import { scoreVerdict } from "@/lib/score-verdict";

/** Circular gauge for a 0-10 score. The ring fills and the number counts up when it appears; the number and verdict word carry the meaning, colour only reinforces it. */
export default function ScoreRing({ score, size = 144 }: { score: number; size?: number }) {
  const stroke = Math.max(8, Math.round(size / 12));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / 10));
  const { color } = scoreVerdict(score);
  const [drawn, setDrawn] = useState(false);
  const shown = useCountUp(score);

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${score} out of 10`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#CFDFD4" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={drawn ? c * (1 - pct) : c} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1100ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="font-black leading-none tracking-tight text-darkslate-900 tabular-nums" style={{ fontSize: size * 0.3 }}>
          {Number.isInteger(score) ? Math.round(shown) : shown.toFixed(1)}
        </span>
        <span className="mt-1 text-xs font-bold text-darkslate-500">out of 10</span>
      </div>
    </div>
  );
}
