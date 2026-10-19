import { describe, expect, it } from "vitest";
import { averageScore, formatDuration, pickQuestions } from "@/lib/session-logic";
import { scoreVerdict } from "@/lib/score-verdict";
import type { Feedback, SessionEntry } from "@/types";

const fb = (score: number): Feedback => ({
  score, summary: "s", strengths: ["a"], areasForImprovement: ["b"], focusNext: "f",
  strongerVersion: "v", followUpQuestion: "q?", howTheyAnswered: "h", toneAnalysis: "t", questionConnection: "c",
});
const entry = (status: SessionEntry["status"], score?: number): SessionEntry => ({
  question: "q", answer: "a", durationSec: 5, status, feedback: score ? fb(score) : undefined,
});

describe("averageScore", () => {
  it("averages to one decimal", () => {
    expect(averageScore([entry("done", 7), entry("done", 6), entry("done", 6)])).toBe(6.3);
  });
  it("ignores answers still loading or failed", () => {
    expect(averageScore([entry("done", 8), entry("loading"), entry("error")])).toBe(8);
  });
  it("is null with nothing reviewed", () => {
    expect(averageScore([])).toBeNull();
    expect(averageScore([entry("loading")])).toBeNull();
  });
});

describe("scoreVerdict", () => {
  it.each([
    [10, "Interview-ready"], [8, "Interview-ready"], [7.9, "Almost there"], [6.5, "Almost there"],
    [6.4, "Needs work"], [4.5, "Needs work"], [4.4, "Not ready yet"], [1, "Not ready yet"],
  ])("score %s is %s", (score, label) => expect(scoreVerdict(score).label).toBe(label));
});

describe("pickQuestions", () => {
  it("returns 12 distinct questions from the track", () => {
    const qs = pickQuestions("Behavioral");
    expect(qs).toHaveLength(12);
    expect(new Set(qs.map((q) => q.id)).size).toBe(12);
  });
  it("picks a different mix of questions from the 15 in a track from one session to the next", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) pickQuestions("Behavioral").forEach((q) => seen.add(q.id));
    expect(seen.size).toBe(15); // over several sessions every question in the track gets used
    expect(pickQuestions("Behavioral", 12, () => 0.1).map((q) => q.id)).not.toEqual(pickQuestions("Behavioral", 12, () => 0.9).map((q) => q.id));
  });
  it("is empty for an unknown track", () => expect(pickQuestions("Nope")).toEqual([]));
});

describe("formatDuration", () => {
  it("formats m:ss", () => expect(formatDuration(65)).toBe("1:05"));
});
