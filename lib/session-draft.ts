// Autosave for a session in progress, kept in this browser so a refresh doesn't lose it.
import type { Question, SessionEntry } from "@/types";
import { getQuestions, isValidTrack } from "@/lib/questions";
import { validateFeedback } from "@/lib/validation";
import type { PracticeMode } from "@/lib/mode-storage";

export const DRAFT_KEY = "intervue_session_draft_v1";
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export interface DraftSession {
  id: string;
  startedAt: string;
  category: string;
  mode: PracticeMode;
  questions: Question[];
  entries: SessionEntry[];
}

export interface DraftCurrent {
  /** What has been typed or spoken so far for the question being answered. */
  answer: string;
  elapsedSec: number;
  spokenSeconds: number;
}

export interface SessionDraft {
  savedAt: string;
  session: DraftSession;
  current: DraftCurrent;
}

/** A draft only counts if the person has actually done something: an answer submitted or text written. */
export function hasContent(session: Pick<DraftSession, "entries">, current: DraftCurrent): boolean {
  return session.entries.length > 0 || current.answer.trim().length > 0;
}

/**
 * Saves the draft. An empty one is never written, so opening a fresh session (for example right after a
 * refresh) can't wipe out the real draft that is waiting to be resumed. Returns whether it saved.
 */
export function saveDraft(session: DraftSession, current: DraftCurrent, now = new Date()): boolean {
  if (!hasContent(session, current)) return false;
  const draft = {
    v: 1,
    savedAt: now.toISOString(),
    session: {
      id: session.id,
      startedAt: session.startedAt,
      category: session.category,
      mode: session.mode,
      questionIds: session.questions.map((q) => q.id),
      entries: session.entries,
    },
    current,
  };
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false; // blocked or full: autosave is a convenience, never an error
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Reads the draft back. Anything stale, corrupt or tampered with is thrown away rather than trusted. */
export function loadDraft(now = new Date()): SessionDraft | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  const discard = () => {
    clearDraft();
    return null;
  };

  try {
    const d: unknown = JSON.parse(raw);
    if (!isRecord(d) || d.v !== 1 || typeof d.savedAt !== "string") return discard();
    const savedAt = Date.parse(d.savedAt);
    if (Number.isNaN(savedAt) || now.getTime() - savedAt > DRAFT_TTL_MS || savedAt > now.getTime() + 60_000) return discard();

    const s = d.session;
    if (!isRecord(s) || typeof s.id !== "string" || !s.id || typeof s.startedAt !== "string" || Number.isNaN(Date.parse(s.startedAt))) return discard();
    if (!isValidTrack(s.category) || (s.mode !== "mic" && s.mode !== "typed")) return discard();
    if (!Array.isArray(s.questionIds) || s.questionIds.length === 0 || s.questionIds.length > 20) return discard();

    const bank = getQuestions(s.category);
    const questions = s.questionIds.map((id) => bank.find((q) => q.id === id));
    if (questions.some((q) => !q)) return discard();

    if (!Array.isArray(s.entries) || s.entries.length > questions.length) return discard();
    const entries: SessionEntry[] = [];
    for (const [i, e] of s.entries.entries()) {
      if (!isRecord(e) || typeof e.answer !== "string" || !e.answer.trim() || e.answer.length > 8000) return discard();
      if (e.question !== questions[i]!.text) return discard(); // the entry must belong to the question in that slot
      const status = e.status === "done" || e.status === "error" ? e.status : "loading";
      let feedback: SessionEntry["feedback"];
      if (e.feedback !== undefined && e.feedback !== null) {
        try {
          feedback = { ...validateFeedback(e.feedback), source: (e.feedback as { source?: "ai" | "basic" }).source, provider: (e.feedback as { provider?: "gemini" | "groq" | "basic" }).provider };
        } catch {
          return discard();
        }
      }
      entries.push({
        question: e.question as string,
        answer: e.answer,
        durationSec: Number.isFinite(Number(e.durationSec)) ? Math.max(0, Number(e.durationSec)) : 0,
        status: status === "done" && !feedback ? "loading" : status,
        feedback,
        error: typeof e.error === "string" ? e.error : undefined,
        spoken: e.spoken === true ? true : undefined,
        delivery: isRecord(e.delivery) ? (e.delivery as unknown as SessionEntry["delivery"]) : undefined,
      });
    }

    const c = isRecord(d.current) ? d.current : {};
    const current: DraftCurrent = {
      answer: typeof c.answer === "string" ? c.answer.slice(0, 8000) : "",
      elapsedSec: Number.isFinite(Number(c.elapsedSec)) ? Math.max(0, Number(c.elapsedSec)) : 0,
      spokenSeconds: Number.isFinite(Number(c.spokenSeconds)) ? Math.max(0, Number(c.spokenSeconds)) : 0,
    };

    const session: DraftSession = {
      id: s.id,
      startedAt: new Date(s.startedAt).toISOString(),
      category: s.category,
      mode: s.mode,
      questions: questions as Question[],
      entries,
    };
    if (!hasContent(session, current)) return discard();
    return { savedAt: new Date(savedAt).toISOString(), session, current };
  } catch {
    return discard();
  }
}
