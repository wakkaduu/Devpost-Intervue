import type { Question } from "@/types";
import questionsData from "@/data/questions.json";
import { TRACK_GROUPS, type TrackGroup } from "@/lib/tracks";

const bank = questionsData as Record<string, Question[]>;

/** Questions asked in one practice session, and the time we budget per answer. */
export const SESSION_QUESTION_COUNT = 5;
const MINUTES_PER_QUESTION = 3;

export const DEFAULT_TRACK = "Behavioral";

export function getTracks(): string[] {
  return Object.keys(bank);
}

export function isValidTrack(track: unknown): track is string {
  return typeof track === "string" && Object.prototype.hasOwnProperty.call(bank, track);
}

export function getQuestions(track: string): Question[] {
  return isValidTrack(track) ? bank[track] : [];
}

/** "Product Manager (Product vision, ...)" -> title and blurb. Plain names have no blurb. */
export function splitTrackName(name: string): { title: string; blurb: string } {
  const match = name.match(/^(.*) \(([^()]*)\)$/);
  return match ? { title: match[1], blurb: match[2] } : { title: name, blurb: "" };
}

export function sessionLength(track: string): { questions: number; minutes: number } {
  const questions = Math.min(SESSION_QUESTION_COUNT, getQuestions(track).length);
  return { questions, minutes: questions * MINUTES_PER_QUESTION };
}

/** Filters the grouped track list by a search string; groups with no match are dropped. */
export function filterTrackGroups(query: string): TrackGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return TRACK_GROUPS;
  return TRACK_GROUPS.map((group) => {
    const groupMatches = group.name.toLowerCase().includes(q);
    const tracks = groupMatches ? group.tracks : group.tracks.filter((t) => t.name.toLowerCase().includes(q));
    return { ...group, tracks };
  }).filter((group) => group.tracks.length > 0);
}

export function getTrackIcon(track: string): string {
  for (const group of TRACK_GROUPS) {
    const found = group.tracks.find((t) => t.name === track);
    if (found) return found.icon;
  }
  return "📋";
}
