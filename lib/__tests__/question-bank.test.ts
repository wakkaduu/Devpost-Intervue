import { describe, expect, it } from "vitest";
import questionsData from "@/data/questions.json";
import { SESSION_QUESTION_COUNT, getQuestions, getTracks, isKnownQuestion } from "@/lib/questions";
import { validateDebriefRequest } from "@/lib/debrief";

const bank = questionsData as Record<string, { id: string; category: string; text: string }[]>;

describe("the question bank", () => {
  it("has 52 tracks, each with at least 15 questions", () => {
    expect(getTracks()).toHaveLength(52);
    for (const [track, qs] of Object.entries(bank)) expect(qs.length, track).toBeGreaterThanOrEqual(15);
  });

  it("has enough questions in every track to fill a full session with room to vary", () => {
    for (const track of getTracks()) expect(getQuestions(track).length, track).toBeGreaterThan(SESSION_QUESTION_COUNT);
  });

  it("has well-formed questions: unique ids, matching category, real text, no duplicates within a track", () => {
    const ids = new Set<string>();
    for (const [track, qs] of Object.entries(bank)) {
      const texts = new Set<string>();
      for (const q of qs) {
        expect(q.category, q.id).toBe(track);
        expect(q.text.trim().length, q.id).toBeGreaterThan(30);
        expect(ids.has(q.id), `duplicate id ${q.id}`).toBe(false);
        ids.add(q.id);
        const key = q.text.trim().toLowerCase();
        expect(texts.has(key), `duplicate text in ${track}`).toBe(false);
        texts.add(key);
      }
    }
    expect(ids.size).toBe(52 * 15);
  });

  it("every question can be read aloud by the server voice, which only reads bank questions", () => {
    for (const qs of Object.values(bank)) for (const q of qs) expect(isKnownQuestion(q.text)).toBe(true);
  });
});

describe("a full session still works end to end", () => {
  const entry = (n: number) => ({ question: `Q${n}`, answer: "a", score: 6, summary: "s", focusNext: "f" });
  it("the debrief accepts a full 12-question session, and still has a sensible upper limit", () => {
    expect(validateDebriefRequest({ category: "Behavioral", entries: Array.from({ length: SESSION_QUESTION_COUNT }, (_, i) => entry(i)) }).entries).toHaveLength(12);
    expect(() => validateDebriefRequest({ category: "Behavioral", entries: Array.from({ length: 21 }, (_, i) => entry(i)) })).toThrow(/Too many/);
  });
});
