import type { Question } from "@/types";
import questionsData from "@/data/questions.json";
import { TRACK_GROUPS, type Track } from "@/lib/tracks";

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

/** All 52 tracks in one flat list (the groups are only an internal ordering, never shown). */
export const ALL_TRACKS: Track[] = TRACK_GROUPS.flatMap((group) => group.tracks);

/** Tracks whose name or description contains the search text. An empty search returns every track. */
export function filterTracks(query: string): Track[] {
  const q = query.trim().toLowerCase();
  return q ? ALL_TRACKS.filter((t) => t.name.toLowerCase().includes(q)) : ALL_TRACKS;
}

export function getTrackIcon(track: string): string {
  for (const group of TRACK_GROUPS) {
    const found = group.tracks.find((t) => t.name === track);
    if (found) return found.icon;
  }
  return "📋";
}

let questionTexts: Set<string> | null = null;
/** True if `text` is exactly one of the questions in the bank. Used so the speech endpoint only ever reads our own questions aloud. */
export function isKnownQuestion(text: unknown): text is string {
  if (typeof text !== "string") return false;
  questionTexts ??= new Set(Object.values(bank).flatMap((qs) => qs.map((q) => q.text)));
  return questionTexts.has(text);
}
