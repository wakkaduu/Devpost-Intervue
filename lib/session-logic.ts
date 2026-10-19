import type { Question, SessionEntry } from "@/types";
import { getQuestions, SESSION_QUESTION_COUNT } from "@/lib/questions";

/** Picks `count` distinct questions from a track in random order (Fisher-Yates). */
export function pickQuestions(track: string, count = SESSION_QUESTION_COUNT, rand: () => number = Math.random): Question[] {
  const pool = [...getQuestions(track)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** Average of reviewed answers to one decimal, or null if none have been reviewed. */
export function averageScore(entries: SessionEntry[]): number | null {
  const scores = entries.flatMap((e) => (e.status === "done" && e.feedback ? [e.feedback.score] : []));
  if (scores.length === 0) return null;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(mean * 10) / 10;
}

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
