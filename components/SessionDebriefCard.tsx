import Button from "@/components/ui/Button";
import type { Debrief } from "@/types";

export type DebriefView =
  | { status: "too-few" }
  | { status: "waiting" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "done"; debrief: Debrief };

/** `numbers` maps a debrief answer number (1-based among reviewed answers) to its question number in the session. */
export default function SessionDebriefCard({
  view,
  numbers,
  onRetry,
}: {
  view: DebriefView;
  numbers: number[];
  onRetry: () => void;
}) {
  const shell = "rounded-2xl bg-sage-100 p-5 sm:p-6 text-darkslate-900";

  if (view.status === "too-few") {
    return (
      <section aria-label="Session debrief" className={shell}>
        <h2 className="text-lg font-bold">Session debrief</h2>
        <p className="mt-1 text-sm text-darkslate-600">Get at least two answers reviewed and I’ll look for patterns across them.</p>
      </section>
    );
  }
  if (view.status === "waiting" || view.status === "loading") {
    return (
      <section aria-label="Session debrief" className={shell}>
        <h2 className="text-lg font-bold">Session debrief</h2>
        <p role="status" className="mt-1 text-sm font-semibold text-darkslate-600">
          {view.status === "waiting" ? "Waiting for your answer reviews to finish…" : "Writing your debrief…"}
        </p>
      </section>
    );
  }
  if (view.status === "error") {
    return (
      <section aria-label="Session debrief" className={shell}>
        <h2 className="text-lg font-bold">Session debrief</h2>
        <div role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <p>{view.error}</p>
          <Button className="mt-2" size="sm" variant="danger" onClick={onRetry}>Retry debrief</Button>
        </div>
      </section>
    );
  }

  const { debrief } = view;
  const q = (n: number) => numbers[n - 1] ?? n;
  return (
    <section aria-label="Session debrief" className={`${shell} space-y-4`}>
      <h2 className="text-lg font-bold">Session debrief</h2>
      <p>{debrief.overview}</p>

      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-forest-700">Patterns across your answers</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5">{debrief.patterns.map((p) => <li key={p}>{p}</li>)}</ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white/70 p-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-forest-700">Best: answer {q(debrief.bestAnswer.number)}</h3>
          <p className="mt-1 text-sm">{debrief.bestAnswer.why}</p>
        </div>
        <div className="rounded-xl bg-white/70 p-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gold-800">Weakest: answer {q(debrief.weakestAnswer.number)}</h3>
          <p className="mt-1 text-sm">{debrief.weakestAnswer.why}</p>
        </div>
      </div>

      <div className="rounded-xl border-l-4 border-gold-500 bg-white/70 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gold-800">Fix this first</h3>
        <p className="mt-1">{debrief.fixFirst}</p>
      </div>
    </section>
  );
}
