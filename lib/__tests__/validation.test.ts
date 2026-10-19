import { describe, expect, it } from "vitest";
import { validateFeedback, validateReviewRequest } from "@/lib/validation";

describe("validateReviewRequest", () => {
  it("accepts a normal request", () => {
    const r = validateReviewRequest({ question: "Q?", answer: "A", category: "Behavioral", mode: "typed" });
    expect(r.answer).toBe("A");
  });
  it("rejects an empty answer", () => {
    expect(() => validateReviewRequest({ question: "Q?", answer: "   ", category: "x" })).toThrow(/answer/);
  });
});

describe("validateFeedback", () => {
  const good = {
    score: 6, summary: "s", strengths: ["a"], areasForImprovement: ["b"], focusNext: "f",
    strongerVersion: "v", followUpQuestion: "q?", howTheyAnswered: "h", toneAnalysis: "t", questionConnection: "c",
  };
  it("accepts a complete review", () => expect(validateFeedback(good).score).toBe(6));
  it("rejects out-of-range scores", () => expect(() => validateFeedback({ ...good, score: 11 })).toThrow());
  it("rejects missing fields", () => expect(() => validateFeedback({ ...good, followUpQuestion: "" })).toThrow());
});
