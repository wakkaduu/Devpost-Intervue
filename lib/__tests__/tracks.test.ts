import { describe, expect, it } from "vitest";
import { TRACK_GROUPS } from "@/lib/tracks";
import { ALL_TRACKS, filterTracks, getTracks, isValidTrack, sessionLength, splitTrackName } from "@/lib/questions";
import { buildInterviewUrl } from "@/lib/start-practice";

describe("tracks", () => {
  const grouped = TRACK_GROUPS.flatMap((g) => g.tracks.map((t) => t.name));
  it("groups exactly the 52 tracks in the question file", () => {
    expect(grouped).toHaveLength(52);
    expect(new Set(grouped).size).toBe(52);
    expect([...grouped].sort()).toEqual([...getTracks()].sort());
  });
  it("splits the blurb off a track name", () => {
    expect(splitTrackName("Human Resources Business Partner (HRBP) (Employee relations)")).toEqual({
      title: "Human Resources Business Partner (HRBP)",
      blurb: "Employee relations",
    });
    expect(splitTrackName("Behavioral")).toEqual({ title: "Behavioral", blurb: "" });
  });
  it("searches tracks and group names", () => {
    expect(filterTracks("")).toHaveLength(52);
    expect(filterTracks("   ")).toHaveLength(52);
    const nursing = filterTracks("NURSING");
    expect(nursing.length).toBeGreaterThan(0);
    expect(nursing.every((t) => t.name.toLowerCase().includes("nursing"))).toBe(true);
    expect(filterTracks("zzzzqqq")).toEqual([]);
  });
  it("lists every track once, in one flat list", () => {
    expect(ALL_TRACKS).toHaveLength(52);
    expect(new Set(ALL_TRACKS.map((t) => t.name)).size).toBe(52);
  });
  it("sizes a session", () => {
    expect(sessionLength("Behavioral")).toEqual({ questions: 12, minutes: 36 });
  });
});

describe("buildInterviewUrl", () => {
  it("builds a URL for a valid track", () => {
    const r = buildInterviewUrl("Behavioral", "typed");
    expect(r).toEqual({ ok: true, url: "/interview?category=Behavioral&mode=typed" });
  });
  it("rejects a missing or unknown track", () => {
    expect(buildInterviewUrl(null, "mic").ok).toBe(false);
    expect(buildInterviewUrl("Nope", "mic").ok).toBe(false);
    expect(isValidTrack("Nope")).toBe(false);
  });
});
