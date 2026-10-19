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

export type SaveResult =
  | { ok: true; where: "account" | "browser"; notice?: string }
  | { ok: false; error: string };

function saveInBrowser(record: SavedSession): boolean {
  try {
    saveGuestSession(record);
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves a finished session. Signed-in users save to their account; guests (or an account save that
 * fails) save in this browser. Idempotent in both places: the same session id is stored once.
 */
export async function saveSession(record: SavedSession, signedIn: boolean): Promise<SaveResult> {
  if (signedIn) {
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: record }),
      });
      if (res.ok) return { ok: true, where: "account" };
    } catch {
      // fall through to the browser copy
    }
    return saveInBrowser(record)
      ? { ok: true, where: "browser", notice: "We couldn't reach your account just now, so this session was saved in this browser instead. You can add it to your account from History." }
      : { ok: false, error: "We couldn't save this session. Your results are still on this page." };
  }
  return saveInBrowser(record)
    ? { ok: true, where: "browser" }
    : { ok: false, error: "We couldn't save this session in your browser. Your results are still on this page." };
}
