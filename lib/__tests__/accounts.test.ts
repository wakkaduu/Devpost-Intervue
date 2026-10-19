import { describe, expect, it } from "vitest";
import { validateRegistration } from "@/lib/auth-validation";
import { safeCallbackPath } from "@/lib/safe-redirect";
import { validateHistoryPayload, validateSavedSession } from "@/lib/history-validation";

describe("validateRegistration", () => {
  const good = { name: "Sam", email: "sam@example.com", password: "longenough1" };
  it("accepts valid input and trims", () => {
    const r = validateRegistration({ ...good, name: "  Sam  ", email: " sam@example.com " });
    expect(r).toEqual({ ok: true, value: good });
  });
  it("reports every bad field", () => {
    const r = validateRegistration({ name: "", email: "nope", password: "short" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "name", "password"]);
  });
  it("rejects passwords over bcrypt's 72-byte limit, counting bytes not characters", () => {
    expect(validateRegistration({ ...good, password: "a".repeat(72) }).ok).toBe(true);
    expect(validateRegistration({ ...good, password: "a".repeat(73) }).ok).toBe(false);
    expect(validateRegistration({ ...good, password: "é".repeat(37) }).ok).toBe(false); // 74 bytes
  });
  it("handles non-object bodies", () => expect(validateRegistration(null).ok).toBe(false));
});

describe("safeCallbackPath", () => {
  it.each([
    ["/history", "/history"], ["/", "/"], [undefined, "/"], [null, "/"], ["", "/"],
    ["https://evil.com", "/"], ["//evil.com", "/"], ["/\\evil.com", "/"], ["javascript:alert(1)", "/"],
  ])("%s -> %s", (input, out) => expect(safeCallbackPath(input as string | undefined)).toBe(out));
});

describe("history validation", () => {
  const session = {
    id: "abc", category: "Behavioral", mode: "typed", averageScore: 6.5, questionCount: 1,
    entries: [{ question: "q", answer: "a", durationSec: 12.4 }], createdAt: "2026-03-01T10:00:00Z",
  };
  it("accepts and normalizes a session", () => {
    const v = validateSavedSession(session);
    expect(v.entries[0].durationSec).toBe(12);
    expect(v.createdAt).toBe("2026-03-01T10:00:00.000Z");
  });
  it.each([
    ["unknown track", { category: "Nope" }],
    ["bad mode", { mode: "x" }],
    ["score too high", { averageScore: 11 }],
    ["score too low", { averageScore: 0 }],
    ["no entries", { entries: [] }],
    ["future date", { createdAt: "2999-01-01T00:00:00Z" }],
    ["empty id", { id: " " }],
    ["huge answer", { entries: [{ question: "q", answer: "x".repeat(8001), durationSec: 1 }] }],
    ["bad feedback", { entries: [{ question: "q", answer: "a", durationSec: 1, feedback: { score: 99 } }] }],
  ])("rejects %s", (_n, patch) => expect(() => validateSavedSession({ ...session, ...patch })).toThrow());
  it("accepts one or many sessions, but not zero or too many", () => {
    expect(validateHistoryPayload({ session })).toHaveLength(1);
    expect(validateHistoryPayload({ sessions: [session, { ...session, id: "b" }] })).toHaveLength(2);
    expect(() => validateHistoryPayload({ sessions: [] })).toThrow();
    expect(() => validateHistoryPayload({ sessions: Array(51).fill(session) })).toThrow(/At most 50/);
    expect(() => validateHistoryPayload({})).toThrow();
  });
});
