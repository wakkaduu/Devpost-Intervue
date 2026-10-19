import { annotateWords, OPTIMAL_WPM, type DeliveryMetrics } from "@/lib/speech-metrics";

export default function DeliveryPanel({ delivery, transcript }: { delivery: DeliveryMetrics; transcript: string }) {
  const good = delivery.paceCategory === "optimal";
  return (
    <section aria-label="Delivery feedback" className="rounded-2xl border border-sage-300 bg-white/60 p-4 text-darkslate-900">
      <h3 className="text-sm font-bold uppercase tracking-wide text-forest-700">How you sounded</h3>
      <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-darkslate-600">Pace</dt>
          <dd className="text-lg font-bold">
            {delivery.wpm} <span className="text-sm font-semibold">words/min</span>
          </dd>
          <dd className={good ? "text-sm font-semibold text-forest-700" : "text-sm font-semibold text-gold-800"}>
            {delivery.paceLabel} <span className="font-normal text-darkslate-600">(aim for {OPTIMAL_WPM.min}–{OPTIMAL_WPM.max})</span>
          </dd>
        </div>
        <div>
          <dt className="text-darkslate-600">Filler words</dt>
          <dd className="text-lg font-bold">{delivery.fillerCount}</dd>
          <dd className="text-sm text-darkslate-700">
            {delivery.fillerMatches.length > 0
              ? delivery.fillerMatches.map((f) => `${f.word} ×${f.count}`).join(", ")
              : "None detected"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-sm">{delivery.coachTip}</p>
      {delivery.fillerCount > 0 && (
        <p className="mt-3 text-sm leading-relaxed" aria-label="Transcript with filler words highlighted">
          {annotateWords(transcript).map((w, i) => (
            <span key={i}>
              {w.filler ? <mark className="rounded bg-gold-200 px-0.5 text-darkslate-900">{w.text}</mark> : w.text}{" "}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
