import Button from "@/components/ui/Button";
import { splitTrackName } from "@/lib/questions";
import type { SessionDraft } from "@/lib/session-draft";

function ago(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

/** Offered when a recent unfinished session was found: pick it up, or discard it and start fresh. */
export default function ResumePrompt({
  draft,
  requestedTrack,
  onResume,
  onStartNew,
}: {
  draft: SessionDraft;
  requestedTrack: string;
  onResume: () => void;
  onStartNew: () => void;
}) {
  const { session, current } = draft;
  const answered = session.entries.length;
  const total = session.questions.length;
  const sameTrack = session.category === requestedTrack;
  const draftTrack = splitTrackName(session.category).title;

  return (
    <div role="region" aria-label="Resume your session" className="card p-5 sm:p-6">
      <h2 className="text-xl font-bold">Pick up where you left off?</h2>
      <p className="mt-2 text-sm">
        You have an unfinished <strong>{draftTrack}</strong> session from {ago(draft.savedAt)}: {answered} of {total} {total === 1 ? "question" : "questions"} answered
        {current.answer.trim() ? ", plus an answer in progress" : ""}.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
        <Button size="lg" className="sm:flex-1" onClick={onResume}>Resume session</Button>
        <Button size="lg" variant="secondary" onClick={onStartNew}>
          {sameTrack ? "Start a new session" : `Start ${splitTrackName(requestedTrack).title} instead`}
        </Button>
      </div>
      <p className="mt-3 text-xs text-darkslate-600">Starting a new session discards the unfinished one.</p>
    </div>
  );
}
