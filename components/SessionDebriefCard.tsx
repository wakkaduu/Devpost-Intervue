import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import type { Debrief } from "@/types";
import ErrorMessage from "@/components/ui/ErrorMessage";

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
  const shell = "card animate-fade-up p-5 sm:p-7";

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
        <div className="mt-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-20 w-full" />
        </div>
      </section>
    );
  }
  if (view.status === "error") {
    return (
      <section aria-label="Session debrief" className={shell}>
        <h2 className="text-lg font-bold">Session debrief</h2>
        <ErrorMessage className="mt-2">
          <p>{view.error}</p>
          <Button className="mt-2" size="sm" variant="danger" onClick={onRetry}>Retry debrief</Button>
        </ErrorMessage>
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
