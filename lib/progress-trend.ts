import type { SavedSession } from "@/types";

export interface TrendPoint {
  id: string;
  category: string;
  score: number;
  createdAt: string;
}

/** One point per session, oldest first, optionally limited to one track. */
export function trendPoints(sessions: SavedSession[], track?: string | null): TrendPoint[] {
  return sessions
    .filter((s) => !track || s.category === track)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((s) => ({ id: s.id, category: s.category, score: s.averageScore, createdAt: s.createdAt }));
}

/** The change from the first session to the latest, with a plain sentence. Null with fewer than two sessions. */
export function trendSummary(points: TrendPoint[]): { change: number; text: string } | null {
  if (points.length < 2) return null;
  const change = Math.round((points[points.length - 1].score - points[0].score) * 10) / 10;
  const abs = Math.abs(change);
  const unit = abs === 1 ? "point" : "points";
  if (change > 0) return { change, text: `Up ${abs} ${unit} since your first session` };
  if (change < 0) return { change, text: `Down ${abs} ${unit} since your first session` };
  return { change, text: "Unchanged since your first session" };
}
