"use client";

import { useState } from "react";
import { splitTrackName } from "@/lib/questions";
import type { TrendPoint } from "@/lib/progress-trend";

const W = 640;
const H = 260;
const PAD = { top: 16, right: 28, bottom: 34, left: 36 };
const TICKS = [0, 2, 4, 6, 8, 10];

const dateFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

/** Average score per session over time, on a fixed 0-10 axis. One series, so no legend: the heading names it. */
export default function ScoreTrendChart({ points }: { points: TrendPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (score: number) => PAD.top + plotH - (score / 10) * plotH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.score)}`).join(" ");
  const last = points.length - 1;

  function nearest(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setActive(best);
  }

  const shown = active !== null ? points[active] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={`Average score per session, ${points.length} ${points.length === 1 ? "session" : "sessions"}, scale 0 to 10`}
        className="h-auto w-full touch-pan-y"
        onPointerMove={nearest}
        onPointerLeave={() => setActive(null)}
      >
        {TICKS.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#CFDFD4" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#52606D">{t}</text>
          </g>
        ))}

        {shown && active !== null && (
          <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} stroke="#7A9E8A" strokeWidth={1} />
        )}

        {points.length > 1 && (
          <path d={path} fill="none" stroke="#344E41" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray={1} className="animate-draw" />
        )}

        {points.map((p, i) => (
          <g key={p.id}>
            {/* 2px surface ring keeps markers legible where they sit on the line */}
            <circle
              cx={x(i)} cy={y(p.score)} r={active === i ? 7 : 5} fill="#344E41" stroke="#E2ECE5" strokeWidth={2}
              className="animate-pop transition-[r] duration-150"
              style={{ transformBox: "fill-box", transformOrigin: "center", animationDelay: `${300 + i * 120}ms` }}
            />
            {/* Hit area and keyboard stop, bigger than the painted marker */}
            <circle
              cx={x(i)}
              cy={y(p.score)}
              r={14}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${fmtDate(p.createdAt)}, ${splitTrackName(p.category).title}: ${p.score} out of 10`}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="outline-none focus-visible:stroke-[#344E41] focus-visible:stroke-2"
            />
          </g>
        ))}

        {/* Label the latest value directly, so the headline number needs no hover */}
        <text x={x(last)} y={y(points[last].score) - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1F2933">
          {points[last].score}
        </text>

        <text x={PAD.left} y={H - 10} fontSize={11} fill="#52606D">{fmtDate(points[0].createdAt)}</text>
        {points.length > 1 && (
          <text x={W - PAD.right} y={H - 10} textAnchor="end" fontSize={11} fill="#52606D">{fmtDate(points[last].createdAt)}</text>
        )}
      </svg>

      {shown && active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-darkslate-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(shown.score) / H) * 100}%`, marginTop: -64 }}
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <span aria-hidden="true" className="inline-block h-0.5 w-3 bg-sage-300" />
            {shown.score} <span className="font-normal text-darkslate-200">out of 10</span>
          </div>
          <div className="text-darkslate-200">{fmtDate(shown.createdAt)} · {splitTrackName(shown.category).title}</div>
        </div>
      )}
    </div>
  );
}
