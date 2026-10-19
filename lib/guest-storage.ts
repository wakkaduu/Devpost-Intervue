// Guest history lives in this browser's localStorage. Saving is an upsert by session id,
// so saving the same session twice never creates a second chart point.
import type { SavedSession } from "@/types";

export const GUEST_SESSIONS_KEY = "intervue_guest_sessions";
const MAX_SESSIONS = 500;

function isSavedSession(value: unknown): value is SavedSession {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.category === "string" &&
    typeof v.averageScore === "number" &&
    typeof v.createdAt === "string" &&
    !Number.isNaN(Date.parse(v.createdAt)) &&
    Array.isArray(v.entries)
  );
}

export function loadGuestSessions(): SavedSession[] {
  try {
    const raw = window.localStorage.getItem(GUEST_SESSIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavedSession) : [];
  } catch {
    return [];
  }
}

/** Throws if the browser refuses to store the data (blocked or full storage). */
export function saveGuestSession(session: SavedSession): void {
  const others = loadGuestSessions().filter((s) => s.id !== session.id);
  const next = [...others, session]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .slice(-MAX_SESSIONS);
  window.localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify(next));
}
