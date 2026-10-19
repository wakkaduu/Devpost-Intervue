// One place for how a score is described, so every screen uses the same words.
// Honest but encouraging: the label says where you are, never "you failed".

export type ScoreTone = "good" | "mid" | "low";

export interface ScoreVerdict {
  label: string;
  tone: ScoreTone;
  /** Mark color on the light sage surface. */
  color: string;
}

export const TONE_COLORS: Record<ScoreTone, string> = {
  good: "#1F7A4D",
  mid: "#9E6600",
  low: "#B42318",
};

export function scoreVerdict(score: number): ScoreVerdict {
  if (score >= 8) return { label: "Interview-ready", tone: "good", color: TONE_COLORS.good };
  if (score >= 6.5) return { label: "Almost there", tone: "good", color: TONE_COLORS.good };
  if (score >= 4.5) return { label: "Needs work", tone: "mid", color: TONE_COLORS.mid };
  return { label: "Not ready yet", tone: "low", color: TONE_COLORS.low };
}
