import { beforeEach, describe, expect, it, vi } from "vitest";
import { GUEST_SESSIONS_KEY, loadGuestSessions, saveGuestSession } from "@/lib/guest-storage";
import { trendPoints, trendSummary } from "@/lib/progress-trend";
import { buildSavedSession, saveSession } from "@/lib/session-save";
import type { SessionState } from "@/context/SessionContext";
import type { SavedSession, SessionEntry } from "@/types";

const saved = (id: string, score: number, createdAt: string, category = "Behavioral"): SavedSession => ({
  id, category, mode: "typed", averageScore: score, questionCount: 3, entries: [], createdAt,
});

beforeEach(() => window.localStorage.clear());

describe("guest storage", () => {
  it("saves and loads a session", () => {
    saveGuestSession(saved("a", 6, "2026-01-01T00:00:00Z"));
    expect(loadGuestSessions().map((s) => s.id)).toEqual(["a"]);
  });

  it("saving the same session twice keeps one point and keeps the latest data", () => {
    saveGuestSession(saved("a", 6, "2026-01-01T00:00:00Z"));
    saveGuestSession(saved("a", 7.5, "2026-01-01T00:00:00Z"));
    const all = loadGuestSessions();
    expect(all).toHaveLength(1);
    expect(all[0].averageScore).toBe(7.5);
  });

  it("ignores corrupt storage and malformed records", () => {
    window.localStorage.setItem(GUEST_SESSIONS_KEY, "{not json");
    expect(loadGuestSessions()).toEqual([]);
    window.localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify([{ id: 1 }, saved("ok", 5, "2026-01-01T00:00:00Z")]));
    expect(loadGuestSessions().map((s) => s.id)).toEqual(["ok"]);
  });

  it("saveSession reports an error instead of throwing when storage is blocked", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    const result = saveSession(saved("a", 6, "2026-01-01T00:00:00Z"));
    spy.mockRestore();
    expect(result.ok).toBe(false);
  });
});

describe("trend", () => {
  const sessions = [
    saved("c", 8, "2026-01-03T00:00:00Z"),
    saved("a", 5, "2026-01-01T00:00:00Z"),
    saved("b", 6.5, "2026-01-02T00:00:00Z", "Cultural Fit"),
  ];
  it("orders points oldest first and filters by track", () => {
    expect(trendPoints(sessions).map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(trendPoints(sessions, "Behavioral").map((p) => p.id)).toEqual(["a", "c"]);
  });
  it("states the change since the first session", () => {
    expect(trendSummary(trendPoints(sessions))).toEqual({ change: 3, text: "Up 3 points since your first session" });
    expect(trendSummary(trendPoints([saved("a", 7, "2026-01-01T00:00:00Z"), saved("b", 6.5, "2026-01-02T00:00:00Z")]))?.text).toBe("Down 0.5 points since your first session");
    expect(trendSummary(trendPoints([saved("a", 7, "2026-01-01T00:00:00Z"), saved("b", 7, "2026-01-02T00:00:00Z")]))?.text).toBe("Unchanged since your first session");
    expect(trendSummary(trendPoints([saved("a", 6, "2026-01-01T00:00:00Z"), saved("b", 7, "2026-01-02T00:00:00Z")]))?.text).toBe("Up 1 point since your first session");
  });
  it("has no summary with fewer than two sessions", () => {
    expect(trendSummary(trendPoints([sessions[0]]))).toBeNull();
    expect(trendSummary([])).toBeNull();
  });
});

describe("buildSavedSession", () => {
  const entry = (status: SessionEntry["status"], score?: number): SessionEntry => ({
    question: "q", answer: "a", durationSec: 4, status,
    feedback: score ? ({ score } as SessionEntry["feedback"]) : undefined,
  });
  const base = (entries: SessionEntry[], finished = true): SessionState => ({
    id: "s1", startedAt: "2026-02-01T10:00:00.000Z", category: "Behavioral", mode: "typed", questions: [], entries, finished,
  });
  it("builds a record from a finished, reviewed session", () => {
    const r = buildSavedSession(base([entry("done", 8), entry("done", 5)]))!;
    expect(r).toMatchObject({ id: "s1", averageScore: 6.5, questionCount: 2, createdAt: "2026-02-01T10:00:00.000Z" });
  });
  it("waits for reviews, and skips unfinished or unscored sessions", () => {
    expect(buildSavedSession(base([entry("done", 8), entry("loading")]))).toBeNull();
    expect(buildSavedSession(base([entry("done", 8)], false))).toBeNull();
    expect(buildSavedSession(base([]))).toBeNull();
    expect(buildSavedSession(base([entry("error")]))).toBeNull();
  });
});
