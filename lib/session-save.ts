import type { SavedSession } from "@/types";
import type { SessionState } from "@/context/SessionContext";
import { averageScore } from "@/lib/session-logic";
import { saveGuestSession } from "@/lib/guest-storage";

/** The record to store for a finished session, or null while reviews are pending or nothing was scored. */
export function buildSavedSession(session: SessionState): SavedSession | null {
  if (!session.finished || session.entries.some((e) => e.status === "loading")) return null;
  const average = averageScore(session.entries);
  if (average === null) return null;
  return {
    id: session.id,
    category: session.category,
    mode: session.mode,
    averageScore: average,
    questionCount: session.entries.length,
    entries: session.entries.map((e) => ({
      question: e.question,
      answer: e.answer,
      durationSec: e.durationSec,
      feedback: e.feedback,
    })),
    createdAt: session.startedAt,
  };
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Saves to the guest store (this browser). Idempotent: the same session id is stored once. */
export function saveSession(record: SavedSession): SaveResult {
  try {
    saveGuestSession(record);
    return { ok: true };
  } catch {
    return { ok: false, error: "We couldn't save this session in your browser. Your results are still on this page." };
  }
}
