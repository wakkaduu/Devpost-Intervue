import { scoreVerdict } from "@/lib/score-verdict";
import { stagger } from "@/lib/motion";
import type { SessionEntry } from "@/types";

/** Each answer's score as a bar, so the strongest and weakest answers are visible at a glance. The bars grow in when they appear. */
export default function ScoreBars({ entries }: { entries: SessionEntry[] }) {
  return (
    <section aria-label="Scores by answer" className="card animate-fade-up p-5 sm:p-6" style={stagger(2)}>
      <h2 className="eyebrow">Score by answer</h2>
      <ul className="mt-3 space-y-3">
        {entries.map((e, i) => {
          const score = e.status === "done" && e.feedback ? e.feedback.score : null;
          return (
            <li key={i} className="flex items-center gap-3 text-sm">
              <span className="w-6 shrink-0 font-semibold tabular-nums text-darkslate-700">Q{i + 1}</span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-sage-300" aria-hidden="true">
                <span
                  className="block h-full origin-left animate-scale-x rounded-full"
                  style={{ width: `${(score ?? 0) * 10}%`, background: score === null ? "transparent" : scoreVerdict(score).color, ...stagger(i + 3, 100) }}
                />
              </span>
              <span className="w-12 shrink-0 text-right font-bold tabular-nums">{score === null ? (e.status === "error" ? "Failed" : "…") : `${score}/10`}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
