"use client";

import Link from "next/link";
import DeliveryPanel from "@/components/DeliveryPanel";
import FeedbackPanel from "@/components/FeedbackPanel";
import ScoreRing from "@/components/ScoreRing";
import Button, { buttonClasses } from "@/components/ui/Button";
import { useSession } from "@/context/SessionContext";
import { splitTrackName } from "@/lib/questions";
import { averageScore, formatDuration } from "@/lib/session-logic";
import { scoreVerdict } from "@/lib/score-verdict";

export default function SessionSummary() {
  const { session, retry } = useSession();

  if (!session || !session.finished) {
    return (
      <div className="rounded-2xl bg-sage-100 p-6 text-darkslate-900">
        <h1 className="text-xl font-semibold">No finished session yet.</h1>
        <p className="mt-1 text-sm">Complete a practice session to see your results here.</p>
        <Link href="/" className={buttonClasses({ className: "mt-4" })}>Back to Home</Link>
      </div>
    );
  }

  const { entries } = session;
  const average = averageScore(entries);
  const pending = entries.filter((e) => e.status === "loading").length;
  const failed = entries.filter((e) => e.status === "error").length;

  return (
    <div className="space-y-5">
      <section aria-label="Your result" className="rounded-2xl bg-sage-100 p-5 sm:p-6 text-darkslate-900">
        <p className="text-xs font-bold uppercase tracking-wide text-forest-600">{splitTrackName(session.category).title}</p>
        {entries.length === 0 ? (
          <div className="mt-2">
            <h1 className="text-xl font-semibold">No answers submitted</h1>
            <p className="mt-1 text-sm">You ended the session before answering, so there is nothing to score. Try again whenever you’re ready.</p>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-5">
            {average !== null ? <ScoreRing score={average} /> : <div className="h-36 w-36 shrink-0 rounded-full bg-sage-300" aria-hidden="true" />}
            <div>
              <h1 className="text-2xl font-bold">{average !== null ? scoreVerdict(average).label : "Reviewing your answers…"}</h1>
              <p className="mt-1 text-sm text-darkslate-600">
                Average of {entries.filter((e) => e.status === "done").length} reviewed {entries.length === 1 ? "answer" : "answers"}
              </p>
              {pending > 0 && <p role="status" className="mt-1 text-sm font-semibold text-gold-800">Still reviewing {pending} {pending === 1 ? "answer" : "answers"}; the score will update.</p>}
              {failed > 0 && <p className="mt-1 text-sm font-semibold text-red-700">{failed} {failed === 1 ? "review" : "reviews"} failed and {failed === 1 ? "isn’t" : "aren’t"} in the average. Retry below.</p>}
            </div>
          </div>
        )}
        <div className="mt-5">
          <Link href="/" className={buttonClasses({ size: "lg", fullWidth: true })}>Practice again</Link>
        </div>
      </section>

      {entries.map((entry, i) => (
        <details key={i} open={i === 0} className="rounded-2xl bg-sage-100 p-4 text-darkslate-900 sm:p-5">
          <summary className="cursor-pointer text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600">
            {i + 1}. {entry.question}
            {entry.feedback && <span className="ml-2 text-sm font-bold text-forest-700">{entry.feedback.score}/10</span>}
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-forest-700">Your answer · {formatDuration(entry.durationSec)}</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm">{entry.answer}</p>
            </div>
            {entry.delivery && <DeliveryPanel delivery={entry.delivery} transcript={entry.answer} />}
            {entry.status === "loading" && <p role="status" className="text-sm font-semibold text-darkslate-600">Reviewing this answer…</p>}
            {entry.status === "error" && (
              <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                <p>{entry.error}</p>
                <Button className="mt-2" size="sm" variant="danger" onClick={() => retry(i)}>Retry review</Button>
              </div>
            )}
            {entry.feedback && <FeedbackPanel feedback={entry.feedback} />}
          </div>
        </details>
      ))}
    </div>
  );
}
