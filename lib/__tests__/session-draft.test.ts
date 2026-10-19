import { beforeEach, describe, expect, it, vi } from "vitest";
import { DRAFT_KEY, DRAFT_TTL_MS, clearDraft, hasContent, loadDraft, saveDraft, type DraftSession } from "@/lib/session-draft";
import { getQuestions } from "@/lib/questions";
import type { SessionEntry } from "@/types";

const qs = getQuestions("Behavioral").slice(0, 5);
const fb = { score: 6, summary: "s", strengths: ["a"], areasForImprovement: ["b"], focusNext: "f", strongerVersion: "v", followUpQuestion: "q?", howTheyAnswered: "h", toneAnalysis: "t", questionConnection: "c" };
const entry = (i: number, over: Partial<SessionEntry> = {}): SessionEntry => ({ question: qs[i].text, answer: `answer ${i}`, durationSec: 30, status: "done", feedback: { ...fb, source: "ai", provider: "gemini" }, ...over });
const session = (entries: SessionEntry[] = []): DraftSession => ({ id: "s1", startedAt: "2026-03-01T10:00:00.000Z", category: "Behavioral", mode: "typed", questions: qs, entries });
const current = (answer = "") => ({ answer, elapsedSec: 12, spokenSeconds: 0 });
const t0 = new Date("2026-03-01T12:00:00Z");
const raw = () => JSON.parse(window.localStorage.getItem(DRAFT_KEY)!);
const put = (obj: unknown) => window.localStorage.setItem(DRAFT_KEY, JSON.stringify(obj));

beforeEach(() => window.localStorage.clear());

describe("saving", () => {
  it("round-trips a session with answers, feedback and a half-written answer", () => {
    expect(saveDraft(session([entry(0), entry(1)]), current("halfway thr"), t0)).toBe(true);
    const d = loadDraft(new Date(t0.getTime() + 60_000))!;
    expect(d.session.entries).toHaveLength(2);
    expect(d.session.entries[0].feedback).toMatchObject({ score: 6, source: "ai", provider: "gemini" });
    expect(d.session.questions.map((q) => q.id)).toEqual(qs.map((q) => q.id));
    expect(d.current).toEqual({ answer: "halfway thr", elapsedSec: 12, spokenSeconds: 0 });
    expect(d.session.id).toBe("s1");
  });

  it("never writes an empty draft", () => {
    expect(hasContent(session(), current(""))).toBe(false);
    expect(hasContent(session(), current("   "))).toBe(false);
    expect(saveDraft(session(), current(""), t0)).toBe(false);
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("an empty draft does not overwrite a real one", () => {
    saveDraft(session([entry(0)]), current("typing"), t0);
    expect(saveDraft(session(), current(""), t0)).toBe(false);
    expect(loadDraft(t0)!.session.entries).toHaveLength(1);
  });

  it("saves once there is typed text, even with no answers yet", () => {
    expect(saveDraft(session(), current("first words"), t0)).toBe(true);
    expect(loadDraft(t0)!.current.answer).toBe("first words");
  });

  it("clearing removes it", () => {
    saveDraft(session([entry(0)]), current(), t0);
    clearDraft();
    expect(loadDraft(t0)).toBeNull();
  });

  it("does not throw when storage is blocked", () => {
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    expect(saveDraft(session([entry(0)]), current(), t0)).toBe(false);
    set.mockRestore();
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(loadDraft(t0)).toBeNull();
    get.mockRestore();
  });
});

describe("the 24 hour window", () => {
  it("offers a draft up to 24 hours old", () => {
    saveDraft(session([entry(0)]), current(), t0);
    expect(loadDraft(new Date(t0.getTime() + DRAFT_TTL_MS - 1000))).not.toBeNull();
  });
  it("discards (and deletes) one older than that", () => {
    saveDraft(session([entry(0)]), current(), t0);
    expect(loadDraft(new Date(t0.getTime() + DRAFT_TTL_MS + 1000))).toBeNull();
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
  it("discards a draft dated in the future", () => {
    saveDraft(session([entry(0)]), current(), new Date(t0.getTime() + 3 * 3600_000));
    expect(loadDraft(t0)).toBeNull();
  });
});

describe("untrusted storage", () => {
  const good = () => { saveDraft(session([entry(0)]), current("x"), t0); return raw(); };
  const bad = (mutate: (d: any) => void) => { const d = good(); mutate(d); put(d); return loadDraft(t0); };

  it("discards corrupt JSON and wrong versions", () => {
    window.localStorage.setItem(DRAFT_KEY, "{not json");
    expect(loadDraft(t0)).toBeNull();
    expect(bad((d) => { d.v = 2; })).toBeNull();
  });
  it.each([
    ["unknown track", (d: any) => { d.session.category = "Nope"; }],
    ["bad mode", (d: any) => { d.session.mode = "x"; }],
    ["unknown question id", (d: any) => { d.session.questionIds[0] = "zzz"; }],
    ["no questions", (d: any) => { d.session.questionIds = []; }],
    ["more answers than questions", (d: any) => { d.session.entries = Array(6).fill(d.session.entries[0]); }],
    ["answer under the wrong question", (d: any) => { d.session.entries[0].question = "something else"; }],
    ["empty answer", (d: any) => { d.session.entries[0].answer = "  "; }],
    ["invalid feedback", (d: any) => { d.session.entries[0].feedback.score = 99; }],
    ["missing id", (d: any) => { d.session.id = ""; }],
  ])("discards a draft with %s", (_n, mutate) => {
    expect(bad(mutate)).toBeNull();
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
  it("treats a finished-looking entry with no feedback as still needing its review", () => {
    const d = bad((x) => { delete x.session.entries[0].feedback; });
    expect(d!.session.entries[0].status).toBe("loading");
  });
  it("keeps reviews that were mid-flight as loading, and failed ones as failed", () => {
    saveDraft(session([entry(0, { status: "loading", feedback: undefined }), entry(1, { status: "error", feedback: undefined, error: "boom" })]), current(), t0);
    const d = loadDraft(t0)!;
    expect(d.session.entries.map((e) => e.status)).toEqual(["loading", "error"]);
  });
  it("clamps nonsense numbers instead of trusting them", () => {
    const d = bad((x) => { x.current.elapsedSec = -5; x.current.spokenSeconds = "abc"; });
    expect(d!.current).toMatchObject({ elapsedSec: 0, spokenSeconds: 0 });
  });
  it("drops a draft that has nothing in it", () => {
    saveDraft(session([entry(0)]), current("x"), t0);
    const d = raw(); d.session.entries = []; d.current.answer = ""; put(d);
    expect(loadDraft(t0)).toBeNull();
  });
});
