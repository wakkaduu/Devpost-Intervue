import { describe, expect, it } from "vitest";
import { TRACK_GROUPS } from "@/lib/tracks";
import { filterTrackGroups, getTracks, isValidTrack, sessionLength, splitTrackName } from "@/lib/questions";
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
    expect(filterTrackGroups("")).toHaveLength(TRACK_GROUPS.length);
    const nursing = filterTrackGroups("nursing").flatMap((g) => g.tracks);
    expect(nursing.length).toBeGreaterThan(0);
    expect(filterTrackGroups("zzzzqqq")).toEqual([]);
  });
  it("sizes a session", () => {
    expect(sessionLength("Behavioral")).toEqual({ questions: 5, minutes: 15 });
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
