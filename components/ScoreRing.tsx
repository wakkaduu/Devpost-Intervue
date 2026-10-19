import { scoreVerdict } from "@/lib/score-verdict";

/** Circular gauge for a 0-10 score. The number and verdict word carry the meaning; color only reinforces it. */
export default function ScoreRing({ score, size = 144 }: { score: number; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / 10));
  const { color } = scoreVerdict(score);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${score} out of 10`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#CFDFD4" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="text-4xl font-black leading-none tracking-tight text-darkslate-900">{score}</span>
        <span className="mt-1 text-xs font-bold text-darkslate-500">out of 10</span>
      </div>
    </div>
  );
}
