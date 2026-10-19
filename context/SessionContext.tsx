"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { Debrief, Feedback, Question, SessionEntry } from "@/types";
import { MIN_DEBRIEF_ENTRIES } from "@/lib/debrief";
import type { PracticeMode } from "@/lib/mode-storage";
import { pickQuestions } from "@/lib/session-logic";
import { analyzeDelivery } from "@/lib/speech-metrics";

export interface SessionState {
  category: string;
  mode: PracticeMode;
  questions: Question[];
  /** One entry per answered question; the next question to ask is questions[entries.length]. */
  entries: SessionEntry[];
  finished: boolean;
  /** AI debrief across the reviewed answers; `forCount` is how many reviewed answers it was written from. */
  debrief?: { status: "loading" | "done" | "error"; forCount: number; data?: Debrief; error?: string };
}

interface SessionApi {
  session: SessionState | null;
  /** Starts a session, or keeps the one in progress for the same track. */
  begin: (category: string, mode: PracticeMode) => void;
  /** Submits the current answer and starts its review in the background. Returns false if the answer is empty. */
  submit: (answer: string, durationSec: number, spokenSeconds?: number) => boolean;
  /** Ends the session now. A non-empty draft for the current question is submitted first. */
  finish: (draft?: { answer: string; durationSec: number; spokenSeconds?: number }) => void;
  retry: (index: number) => void;
  /** Asks for the session debrief from the answers reviewed so far. No-op while one is loading or with too few answers. */
  requestDebrief: () => void;
}

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  // The ref always holds the newest state so background reviews that finish later patch the right session.
  const ref = useRef<SessionState | null>(null);
  const update = useCallback((next: SessionState | null) => {
    ref.current = next;
    setSession(next);
  }, []);

  const patchEntry = useCallback(
    (owner: SessionState["questions"], index: number, patch: Partial<SessionEntry>) => {
      const cur = ref.current;
      // Ignore results that arrive after a newer session replaced this one.
      if (!cur || cur.questions !== owner) return;
      update({ ...cur, entries: cur.entries.map((e, i) => (i === index ? { ...e, ...patch } : e)) });
    },
    [update]
  );

  const runReview = useCallback(
    async (index: number) => {
      const cur = ref.current;
      if (!cur) return;
      const owner = cur.questions;
      const entry = cur.entries[index];
      const priorFocus = cur.entries.slice(0, index).flatMap((e) => (e.feedback ? [e.feedback.focusNext] : []));
      patchEntry(owner, index, { status: "loading", error: undefined });
      try {
        const res = await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: entry.question,
            answer: entry.answer,
            category: cur.category,
            mode: entry.spoken ? "mic" : "typed",
            priorFocus,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
        patchEntry(owner, index, { status: "done", feedback: data.feedback as Feedback });
      } catch (err) {
        patchEntry(owner, index, { status: "error", error: err instanceof Error ? err.message : "Something went wrong." });
      }
    },
    [patchEntry]
  );

  const requestDebrief = useCallback(async () => {
    const cur = ref.current;
    if (!cur || cur.debrief?.status === "loading") return;
    const reviewed = cur.entries.filter((e) => e.status === "done" && e.feedback);
    if (reviewed.length < MIN_DEBRIEF_ENTRIES) return;
    const owner = cur.questions;
    const forCount = reviewed.length;
    const setDebrief = (debrief: NonNullable<SessionState["debrief"]>) => {
      const latest = ref.current;
      if (latest && latest.questions === owner) update({ ...latest, debrief });
    };
    setDebrief({ status: "loading", forCount });
    try {
      const res = await fetch("/api/review/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: cur.category,
          entries: reviewed.map((e) => ({
            question: e.question,
            answer: e.answer,
            score: e.feedback!.score,
            summary: e.feedback!.summary,
            focusNext: e.feedback!.focusNext,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setDebrief({ status: "done", forCount, data: data.debrief as Debrief });
    } catch (err) {
      setDebrief({ status: "error", forCount, error: err instanceof Error ? err.message : "Something went wrong." });
    }
  }, [update]);

  const begin = useCallback(
    (category: string, mode: PracticeMode) => {
      const cur = ref.current;
      if (cur && cur.category === category && !cur.finished) return;
      update({ category, mode, questions: pickQuestions(category), entries: [], finished: false });
    },
    [update]
  );

  const addEntry = useCallback(
    (answer: string, durationSec: number, spokenSeconds = 0): boolean => {
      const cur = ref.current;
      const text = answer.trim();
      if (!cur || cur.finished || !text || cur.entries.length >= cur.questions.length) return false;
      const index = cur.entries.length;
      const entry: SessionEntry = {
        question: cur.questions[index].text,
        answer: text,
        durationSec: Math.round(durationSec),
        status: "loading",
      };
      if (spokenSeconds > 0) {
        entry.spoken = true;
        entry.delivery = analyzeDelivery(text, spokenSeconds) ?? undefined;
      }
      const entries = [...cur.entries, entry];
      update({ ...cur, entries, finished: entries.length === cur.questions.length });
      void runReview(index);
      return true;
    },
    [update, runReview]
  );

  const finish = useCallback(
    (draft?: { answer: string; durationSec: number; spokenSeconds?: number }) => {
      if (draft) addEntry(draft.answer, draft.durationSec, draft.spokenSeconds);
      const cur = ref.current;
      if (cur && !cur.finished) update({ ...cur, finished: true });
    },
    [addEntry, update]
  );

  const retry = useCallback((index: number) => void runReview(index), [runReview]);

  return (
    <SessionContext.Provider value={{ session, begin, submit: addEntry, finish, retry, requestDebrief }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionApi {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
