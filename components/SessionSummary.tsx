"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession as useAccount } from "next-auth/react";
import DeliveryPanel from "@/components/DeliveryPanel";
import FeedbackPanel from "@/components/FeedbackPanel";
import ScoreBars from "@/components/ScoreBars";
import SessionDebriefCard, { type DebriefView } from "@/components/SessionDebriefCard";
import Accordion from "@/components/ui/Accordion";
import Page from "@/components/ui/Page";
import Skeleton from "@/components/ui/Skeleton";
import { stagger } from "@/lib/motion";
import ScoreRing from "@/components/ScoreRing";
import Button, { buttonClasses } from "@/components/ui/Button";
import { useSession } from "@/context/SessionContext";
import { splitTrackName } from "@/lib/questions";
import { MIN_DEBRIEF_ENTRIES } from "@/lib/debrief";
import { averageScore, formatDuration } from "@/lib/session-logic";
import { scoreVerdict } from "@/lib/score-verdict";
import { buildSavedSession, saveSession, type SaveResult } from "@/lib/session-save";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function SessionSummary() {
  const { session, retry, requestDebrief } = useSession();

  const { status: accountStatus } = useAccount();
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);

  // Save once every review has settled. Saving is an upsert by session id, so a retried review
  // updates the same history point instead of adding another.
  const record = session ? buildSavedSession(session) : null;
  const recordKey = record ? `${record.id}:${record.averageScore}:${record.questionCount}` : null;
  useEffect(() => {
    if (!record || accountStatus === "loading") return;
    let cancelled = false;
    saveSession(record, accountStatus === "authenticated").then((r) => {
      if (!cancelled) setSaveResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [recordKey, accountStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const reviewedCount = session?.entries.filter((e) => e.status === "done").length ?? 0;
  const anyLoading = session?.entries.some((e) => e.status === "loading") ?? false;
  const debriefState = session?.debrief;
  // Write the debrief once every review has settled. A retried review that adds an answer triggers a fresh one.
  const needsDebrief =
    !!session?.finished && !anyLoading && reviewedCount >= MIN_DEBRIEF_ENTRIES &&
    (!debriefState || (debriefState.status !== "loading" && debriefState.forCount !== reviewedCount));
  useEffect(() => {
    if (needsDebrief) requestDebrief();
  }, [needsDebrief, requestDebrief]);

  if (!session || !session.finished) {
    return (
      <Page><div className="card mx-auto max-w-xl p-6">
        <h1 className="text-xl font-semibold">No finished session yet.</h1>
        <p className="mt-1 text-sm">Complete a practice session to see your results here.</p>
        <Link href="/" className={buttonClasses({ className: "mt-4" })}>Back to Home</Link>
      </div></Page>
    );
  }

  const { entries } = session;
  const average = averageScore(entries);
  const pending = entries.filter((e) => e.status === "loading").length;
  const failed = entries.filter((e) => e.status === "error").length;
  const basicCount = entries.filter((e) => e.feedback?.source === "basic").length;

  const reviewedNumbers = entries.flatMap((e, i) => (e.status === "done" ? [i + 1] : []));
  let debriefView: DebriefView;
  if (reviewedCount < MIN_DEBRIEF_ENTRIES && !anyLoading) debriefView = { status: "too-few" };
  else if (debriefState?.status === "done" && debriefState.data) debriefView = { status: "done", debrief: debriefState.data };
  else if (debriefState?.status === "error") debriefView = { status: "error", error: debriefState.error ?? "Something went wrong." };
  else if (debriefState?.status === "loading") debriefView = { status: "loading" };
  else debriefView = { status: "waiting" };

  return (
    <Page>
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-6 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:col-span-4 lg:self-start">
          <section aria-label="Your result" className="card animate-scale-in p-5 sm:p-7">
            <p className="eyebrow">{splitTrackName(session.category).title}</p>
            {entries.length === 0 ? (
              <div className="mt-2">
                <h1 className="text-xl font-semibold">No answers submitted</h1>
                <p className="mt-1 text-sm">You ended the session before answering, so there is nothing to score. Try again whenever you’re ready.</p>
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left lg:flex-col lg:text-center xl:flex-row xl:text-left">
                {average !== null ? <ScoreRing score={average} size={160} /> : <Skeleton className="h-40 w-40 shrink-0 rounded-full" />}
                <div>
                  <h1 className="text-3xl font-black leading-tight">{average !== null ? scoreVerdict(average).label : "Reviewing your answers…"}</h1>
                  <p className="mt-1 text-sm text-darkslate-600">
                    Average of {entries.filter((e) => e.status === "done").length} reviewed {entries.length === 1 ? "answer" : "answers"}
                  </p>
                </div>
              </div>
            )}
            <div className="mt-3 space-y-1.5">
              {basicCount > 0 && <p className="text-sm font-semibold text-gold-800">{basicCount} {basicCount === 1 ? "answer has" : "answers have"} basic feedback only, so this score is rough. Open {basicCount === 1 ? "it" : "them"} below to try the AI review again.</p>}
              {pending > 0 && <p role="status" className="text-sm font-semibold text-gold-800">Still reviewing {pending} {pending === 1 ? "answer" : "answers"}; the score will update.</p>}
              {failed > 0 && <p className="text-sm font-semibold text-red-700">{failed} {failed === 1 ? "review" : "reviews"} failed and {failed === 1 ? "isn’t" : "aren’t"} in the average. Retry below.</p>}
            </div>
            {saveResult && (
              saveResult.ok ? (
                <div role="status" className="mt-4 text-sm text-darkslate-600">
                  {saveResult.notice && <ErrorMessage variant="warning" className="mb-1 font-semibold">{saveResult.notice}</ErrorMessage>}
                  Saved to your history{saveResult.where === "account" ? " (your account)" : ""}.{" "}
                  <Link href="/history" className="font-semibold text-forest-700 underline">See your progress</Link>
                </div>
              ) : (
                <ErrorMessage className="mt-4">{saveResult.error}</ErrorMessage>
              )
            )}
            <div className="mt-5">
              <Link href="/" className={buttonClasses({ size: "lg", fullWidth: true })}>Practice again</Link>
            </div>
          </section>
          {entries.length > 1 && <ScoreBars entries={entries} />}
        </div>

        <div className="space-y-6 lg:col-span-8">
          {entries.length > 0 && <SessionDebriefCard view={debriefView} numbers={reviewedNumbers} onRetry={requestDebrief} />}

          {entries.map((entry, i) => (
            <div key={i} className="card card-hover animate-fade-up" style={stagger(i + 1, 90)}>
              <Accordion
                headingLevel={2}
                defaultOpen={i === 0}
                eyebrow={`Answer ${i + 1} · ${formatDuration(entry.durationSec)}`}
                title={entry.question}
                badge={<AnswerBadge entry={entry} />}
              >
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-forest-700">Your answer</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{entry.answer}</p>
                  </div>
                  {entry.delivery && <DeliveryPanel delivery={entry.delivery} transcript={entry.answer} />}
                  {entry.status === "loading" && (
                    <div className="space-y-2">
                      <LoadingSpinner label="Reviewing this answer…" />
                      <Skeleton className="h-4 w-11/12" />
                      <Skeleton className="h-4 w-9/12" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  )}
                  {entry.status === "error" && (
                    <ErrorMessage>
                      <p>{entry.error}</p>
                      <Button className="mt-2" size="sm" variant="danger" onClick={() => retry(i)}>Retry review</Button>
                    </ErrorMessage>
                  )}
                  {entry.feedback && <FeedbackPanel feedback={entry.feedback} onRetry={entry.status === "loading" ? undefined : () => retry(i)} />}
                </div>
              </Accordion>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}

/** The small status pill on an answer's header: its score, a "reviewing" spinner, or a failure. */
function AnswerBadge({ entry }: { entry: import("@/types").SessionEntry }) {
  if (entry.status === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-2.5 py-1 text-xs font-bold text-gold-900">
        <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Reviewing
      </span>
    );
  }
  if (entry.status === "error") return <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-800">Failed</span>;
  if (!entry.feedback) return null;
  const tone = scoreVerdict(entry.feedback.score).tone;
  const colour = tone === "good" ? "bg-emerald-100 text-emerald-900" : tone === "mid" ? "bg-gold-100 text-gold-900" : "bg-red-50 text-red-800";
  return <span className={`animate-pop rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${colour}`}>{entry.feedback.score}/10</span>;
}
