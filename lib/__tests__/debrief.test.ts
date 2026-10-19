import { describe, expect, it } from "vitest";
import { buildDebriefPrompt, validateDebrief, validateDebriefRequest } from "@/lib/debrief";

const entry = (n: number) => ({ question: `Q${n}?`, answer: `I did thing ${n}`, score: 6, summary: "ok", focusNext: "state the result" });
const request = { category: "Behavioral", entries: [entry(1), entry(2), entry(3)] };

describe("validateDebriefRequest", () => {
  it("accepts reviewed answers", () => expect(validateDebriefRequest(request).entries).toHaveLength(3));
  it("needs at least two answers", () => {
    expect(() => validateDebriefRequest({ ...request, entries: [entry(1)] })).toThrow(/at least 2/);
  });
  it("rejects bad scores and missing text", () => {
    expect(() => validateDebriefRequest({ ...request, entries: [entry(1), { ...entry(2), score: 11 }] })).toThrow(/score/);
    expect(() => validateDebriefRequest({ ...request, entries: [entry(1), { ...entry(2), answer: " " }] })).toThrow(/answer/);
    expect(() => validateDebriefRequest("nope")).toThrow();
  });
});

describe("buildDebriefPrompt", () => {
  it("includes every answer, numbered", () => {
    const p = buildDebriefPrompt(validateDebriefRequest(request));
    expect(p).toContain("Answer 3");
    expect(p).toContain("I did thing 2");
  });
});

describe("validateDebrief", () => {
  const good = {
    overview: "o", patterns: ["p"], bestAnswer: { number: 1, why: "w" }, weakestAnswer: { number: 3, why: "w" }, fixFirst: "f",
  };
  it("accepts a complete debrief", () => expect(validateDebrief(good, 3).fixFirst).toBe("f"));
  it("rejects answer numbers outside the session", () => {
    expect(() => validateDebrief({ ...good, weakestAnswer: { number: 4, why: "w" } }, 3)).toThrow(/1-3/);
  });
  it("rejects empty patterns", () => expect(() => validateDebrief({ ...good, patterns: [] }, 3)).toThrow());
});
