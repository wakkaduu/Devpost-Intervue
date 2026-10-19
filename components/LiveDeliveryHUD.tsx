"use client";

import { useMemo, useState } from "react";
import { OPTIMAL_WPM, analyzeDelivery } from "@/lib/speech-metrics";

const MIN_SECONDS = 5;
const MIN_WORDS = 8;

/** A small live read-out of pace and filler words while the person speaks. It can be hidden if it distracts. */
export default function LiveDeliveryHUD({ transcript, seconds }: { transcript: string; seconds: number }) {
  const [shown, setShown] = useState(true);
  const metrics = useMemo(() => {
    const words = transcript.trim().split(/\s+/).filter(Boolean).length;
    return seconds >= MIN_SECONDS && words >= MIN_WORDS ? analyzeDelivery(transcript, seconds) : null;
  }, [transcript, seconds]);

  return (
    <div className="mt-2 rounded-xl border border-sage-300 bg-white/70 p-3 text-sm text-darkslate-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-forest-700">Live delivery</span>
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          className="rounded text-xs font-semibold text-forest-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {shown && (
        <p className="mt-1" aria-live="off">
          {metrics ? (
            <>
              <span className="font-bold tabular-nums">{metrics.wpm}</span> words/min ·{" "}
              <span className={metrics.paceCategory === "optimal" ? "font-semibold text-forest-700" : "font-semibold text-gold-800"}>
                {metrics.paceLabel}
              </span>{" "}
              <span className="text-darkslate-600">(aim for {OPTIMAL_WPM.min}–{OPTIMAL_WPM.max})</span> ·{" "}
              <span className="font-bold tabular-nums">{metrics.fillerCount}</span> filler {metrics.fillerCount === 1 ? "word" : "words"}
            </>
          ) : (
            <span className="text-darkslate-600">Measuring your pace… keep talking.</span>
          )}
        </p>
      )}
    </div>
  );
}
