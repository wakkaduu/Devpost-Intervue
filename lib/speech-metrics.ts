// Delivery metrics for spoken answers, computed in the browser from the transcript and the speaking time.

export interface FillerMatch {
  word: string;
  count: number;
}

export type PaceCategory = "too-slow" | "slow" | "optimal" | "fast" | "too-fast";

export interface DeliveryMetrics {
  totalWords: number;
  durationSeconds: number;
  wpm: number;
  paceCategory: PaceCategory;
  paceLabel: string;
  fillerCount: number;
  fillerMatches: FillerMatch[];
  /** Share of words that are fillers, as a percentage with one decimal. */
  fillerPercent: number;
  coachTip: string;
}

export const FILLER_WORDS = [
  "um", "uh", "er", "ah", "like", "you know", "literally", "basically", "sort of", "kind of", "i mean", "actually",
];

export const OPTIMAL_WPM = { min: 120, max: 160 };

const FILLER_PATTERNS = FILLER_WORDS.map((word) => ({ word, regex: new RegExp(`\\b${word}\\b`, "gi") }));

export function categorizePace(wpm: number): { category: PaceCategory; label: string; tip: string } {
  if (wpm < 100) {
    return { category: "too-slow", label: "Very deliberate", tip: "Your pace was quite slow. Moving between points more fluidly will keep the interviewer engaged." };
  }
  if (wpm < OPTIMAL_WPM.min) {
    return { category: "slow", label: "Thoughtful", tip: "Clear, but a little slow. A slightly quicker pace can sound more confident." };
  }
  if (wpm <= OPTIMAL_WPM.max) {
    return { category: "optimal", label: "Good pace", tip: "Your pace is in the range interviewers find easy to follow." };
  }
  if (wpm <= 185) {
    return { category: "fast", label: "Brisk", tip: "A little fast. Pause briefly after key achievements so they land." };
  }
  return { category: "too-fast", label: "Rushed", tip: "You spoke very quickly. Slow down and breathe between sentences." };
}

/** Returns null when there is no speech to measure. */
export function analyzeDelivery(transcript: string, speakingSeconds: number): DeliveryMetrics | null {
  const text = transcript.trim();
  if (!text) return null;

  const totalWords = text.split(/\s+/).length;
  // A 2-second floor stops very short clips from producing absurd words-per-minute values.
  const seconds = Math.max(speakingSeconds, 2);
  const wpm = Math.round(totalWords / (seconds / 60));
  const pace = categorizePace(wpm);

  const fillerMatches = FILLER_PATTERNS.flatMap(({ word, regex }) => {
    const count = text.match(regex)?.length ?? 0;
    return count > 0 ? [{ word, count }] : [];
  }).sort((a, b) => b.count - a.count);
  const fillerCount = fillerMatches.reduce((n, f) => n + f.count, 0);
  const fillerPercent = Math.round((fillerCount / totalWords) * 1000) / 10;

  let coachTip = pace.tip;
  if (fillerCount > 0) {
    const top = fillerMatches.slice(0, 2).map((f) => `“${f.word}”`).join(" and ");
    coachTip += fillerPercent > 5
      ? ` You used filler words often (${top}). Try a short, confident pause instead.`
      : ` Filler words were under control (${top} a few times).`;
  } else if (totalWords >= 20) {
    coachTip += " No filler words detected.";
  }

  return {
    totalWords,
    durationSeconds: Math.round(speakingSeconds),
    wpm,
    paceCategory: pace.category,
    paceLabel: pace.label,
    fillerCount,
    fillerMatches,
    fillerPercent,
    coachTip,
  };
}

/** Splits a transcript into words, marking single-word fillers so the UI can highlight them. */
export function annotateWords(transcript: string): { text: string; filler: boolean }[] {
  const singles = new Set(FILLER_WORDS.filter((w) => !w.includes(" ")));
  return transcript.trim().split(/\s+/).filter(Boolean).map((text) => ({
    text,
    filler: singles.has(text.toLowerCase().replace(/[^a-z']/g, "")),
  }));
}
