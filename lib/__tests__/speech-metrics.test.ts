import { describe, expect, it } from "vitest";
import { analyzeDelivery, annotateWords, categorizePace } from "@/lib/speech-metrics";

describe("categorizePace", () => {
  it.each([
    [90, "too-slow"], [110, "slow"], [120, "optimal"], [160, "optimal"], [170, "fast"], [200, "too-fast"],
  ])("%s wpm is %s", (wpm, cat) => expect(categorizePace(wpm).category).toBe(cat));
});

describe("analyzeDelivery", () => {
  it("returns null with no speech", () => expect(analyzeDelivery("   ", 30)).toBeNull());

  it("computes words per minute", () => {
    const text = Array(60).fill("word").join(" ");
    const d = analyzeDelivery(text, 30)!;
    expect(d.totalWords).toBe(60);
    expect(d.wpm).toBe(120);
    expect(d.paceCategory).toBe("optimal");
  });

  it("counts fillers, including phrases, case-insensitively", () => {
    const d = analyzeDelivery("Um I basically, you know, like led the Um project", 10)!;
    const byWord = Object.fromEntries(d.fillerMatches.map((f) => [f.word, f.count]));
    expect(byWord).toEqual({ um: 2, basically: 1, "you know": 1, like: 1 });
    expect(d.fillerCount).toBe(5);
  });

  it("does not match fillers inside other words", () => {
    expect(analyzeDelivery("The umbrella liked the alike plan", 10)!.fillerCount).toBe(0);
  });

  it("floors very short durations so wpm stays sane", () => {
    expect(analyzeDelivery("hello there", 0)!.wpm).toBe(60);
  });
});

describe("annotateWords", () => {
  it("marks single-word fillers", () => {
    expect(annotateWords("so, um, yes").map((w) => w.filler)).toEqual([false, true, false]);
  });
});
