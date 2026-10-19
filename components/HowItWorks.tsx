import { stagger } from "@/lib/motion";

const STEPS = [
  { n: 1, title: "Pick a track", body: "52 fields, from engineering and medicine to visas and pitch competitions." },
  { n: 2, title: "Answer out loud or in writing", body: "Live transcript, pace and filler words as you speak." },
  { n: 3, title: "Get coached on every answer", body: "A score, what to fix first, a stronger version, and the follow-up question." },
];

export default function HowItWorks() {
  return (
    <section aria-labelledby="how-heading">
    <h2 id="how-heading" className="sr-only">How Intervue works</h2>
    <ol className="grid gap-4 sm:grid-cols-3">
      {STEPS.map((s, i) => (
        <li key={s.n} className="card card-hover animate-fade-up p-4" style={stagger(i + 2)}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-700 text-sm font-bold text-white" aria-hidden="true">{s.n}</span>
          <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
          <p className="mt-1 text-sm text-darkslate-600">{s.body}</p>
        </li>
      ))}
    </ol>
    </section>
  );
}
