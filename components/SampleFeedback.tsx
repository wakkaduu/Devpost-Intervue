import { stagger } from "@/lib/motion";

/** A made-up example, clearly labelled, so a first-time visitor can see what the coaching looks like before starting. */
export default function SampleFeedback() {
  return (
    <section aria-labelledby="sample-heading" className="card relative overflow-hidden p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="sample-heading" className="eyebrow">Example feedback</h2>
        <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-semibold text-gold-900">Sample, not your answer</span>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_2fr]">
      <blockquote className="rounded-xl border-l-4 border-sage-400 bg-white/60 p-4 text-sm italic text-darkslate-700">
        “My teammate and I disagreed about shipping before the sale. We had a call and agreed on a feature flag. It worked out fine.”
      </blockquote>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="animate-fade-up rounded-xl border-l-4 border-gold-500 bg-white/70 p-3" style={stagger(1)}>
          <h3 className="text-xs font-bold uppercase tracking-wide text-gold-800">Work on this first</h3>
          <p className="mt-1 text-sm">You never said why your teammate disagreed, so the conflict feels one-sided. Explain her argument and what you weighed.</p>
        </div>
        <div className="animate-fade-up rounded-xl bg-forest-700 p-3 text-white" style={stagger(2)}>
          <h3 className="text-xs font-bold uppercase tracking-wide text-gold-300">The follow-up a real interviewer would ask</h3>
          <p className="mt-1 text-sm">What would you have done if she had refused the feature flag?</p>
        </div>
      </div>
      </div>
      <p className="mt-4 text-sm text-darkslate-600">
        Every review quotes your own words, picks <strong>one</strong> thing to fix, and shows a stronger way to say it.
      </p>
    </section>
  );
}
