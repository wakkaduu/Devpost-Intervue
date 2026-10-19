// Validation for session data posted to /api/history.
import type { Feedback, SavedSession } from "@/types";
import { isValidTrack } from "@/lib/questions";
import { validateFeedback } from "@/lib/validation";

export const MAX_SESSIONS_PER_REQUEST = 50;
const MAX_ENTRIES = 50;

function fail(message: string): never {
  throw new Error(message);
}

export function validateSavedSession(value: unknown): SavedSession {
  if (typeof value !== "object" || value === null) fail("Session must be an object.");
  const v = value as Record<string, unknown>;

  if (typeof v.id !== "string" || !v.id.trim() || v.id.length > 100) fail("Session id is invalid.");
  if (!isValidTrack(v.category)) fail("Session track is invalid.");
  if (v.mode !== "typed" && v.mode !== "mic") fail("Session mode is invalid.");
  const averageScore = Number(v.averageScore);
  if (!Number.isFinite(averageScore) || averageScore < 1 || averageScore > 10) fail("Average score must be between 1 and 10.");
  if (!Array.isArray(v.entries) || v.entries.length < 1 || v.entries.length > MAX_ENTRIES) fail("Session entries are invalid.");
  const questionCount = Number(v.questionCount);
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > MAX_ENTRIES) fail("Question count is invalid.");
  const created = typeof v.createdAt === "string" ? Date.parse(v.createdAt) : NaN;
  if (Number.isNaN(created) || created > Date.now() + 24 * 3600 * 1000) fail("Session date is invalid.");

  const entries = v.entries.map((raw) => {
    if (typeof raw !== "object" || raw === null) fail("Entry must be an object.");
    const e = raw as Record<string, unknown>;
    if (typeof e.question !== "string" || !e.question.trim() || e.question.length > 1000) fail("Entry question is invalid.");
    if (typeof e.answer !== "string" || !e.answer.trim() || e.answer.length > 8000) fail("Entry answer is invalid.");
    const durationSec = Number(e.durationSec);
    if (!Number.isFinite(durationSec) || durationSec < 0 || durationSec > 36000) fail("Entry duration is invalid.");
    let feedback: Feedback | undefined;
    if (e.feedback !== undefined && e.feedback !== null) feedback = validateFeedback(e.feedback);
    return { question: e.question, answer: e.answer, durationSec: Math.round(durationSec), feedback };
  });

  return {
    id: v.id.trim(),
    category: v.category as string,
    mode: v.mode,
    averageScore: Math.round(averageScore * 10) / 10,
    questionCount,
    entries,
    createdAt: new Date(created).toISOString(),
  };
}

/** Accepts `{ session }` or `{ sessions: [...] }` and returns validated sessions. */
export function validateHistoryPayload(body: unknown): SavedSession[] {
  if (typeof body !== "object" || body === null) fail("Request body must be an object.");
  const b = body as Record<string, unknown>;
  const raw = Array.isArray(b.sessions) ? b.sessions : b.session !== undefined ? [b.session] : fail("Provide a session or sessions.");
  if (raw.length === 0) fail("Provide at least one session.");
  if (raw.length > MAX_SESSIONS_PER_REQUEST) fail(`At most ${MAX_SESSIONS_PER_REQUEST} sessions per request.`);
  return raw.map(validateSavedSession);
}
