import Button from "@/components/ui/Button";
import type { Feedback } from "@/types";

export default function FeedbackPanel({ feedback, onRetry }: { feedback: Feedback; onRetry?: () => void }) {
  return (
    <section aria-label="Your review" className="rounded-2xl bg-sage-100 p-5 sm:p-6 space-y-5 text-darkslate-900">
      {feedback.source === "basic" && (
        <div role="status" className="rounded-xl border border-gold-300 bg-gold-100 p-3 text-sm text-gold-900">
          <p className="font-semibold">Basic feedback</p>
          <p>The AI reviewers couldn’t be reached, so this review comes from simple checks and isn’t a full read of your answer.</p>
          {onRetry && <Button className="mt-2" size="sm" variant="secondary" onClick={onRetry}>Try the AI review again</Button>}
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-forest-700 text-2xl font-bold text-white" aria-label={`Score ${feedback.score} out of 10`}>
          {feedback.score}
        </div>
        <p className="text-base leading-relaxed">{feedback.summary}</p>
      </div>

      <div className="rounded-xl border-l-4 border-gold-500 bg-white/70 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gold-800">Work on this first</h3>
        <p className="mt-1">{feedback.focusNext}</p>
      </div>

      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-forest-700">A stronger way to say it</h3>
        <p className="mt-1 italic">{feedback.strongerVersion}</p>
      </div>

      <div className="rounded-xl bg-forest-700 p-4 text-white">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gold-300">The follow-up a real interviewer would ask</h3>
        <p className="mt-1">{feedback.followUpQuestion}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-forest-700">What worked</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">{feedback.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-forest-700">What to fix</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">{feedback.areasForImprovement.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      </div>

      <dl className="space-y-2 text-sm text-darkslate-700">
        <div><dt className="inline font-semibold">How you answered: </dt><dd className="inline">{feedback.howTheyAnswered}</dd></div>
        <div><dt className="inline font-semibold">Tone: </dt><dd className="inline">{feedback.toneAnalysis}</dd></div>
        <div><dt className="inline font-semibold">Did you answer the question: </dt><dd className="inline">{feedback.questionConnection}</dd></div>
      </dl>
    </section>
  );
}
