import { isValidTrack } from "@/lib/questions";
import type { PracticeMode } from "@/lib/mode-storage";

/** Returns the interview URL, or an error message if the choices can't start a session. */
export function buildInterviewUrl(
  track: string | null,
  mode: PracticeMode
): { ok: true; url: string } | { ok: false; error: string } {
  if (!track || !isValidTrack(track)) {
    return { ok: false, error: "Choose a track before you start." };
  }
  const params = new URLSearchParams({ category: track, mode });
  return { ok: true, url: `/interview?${params.toString()}` };
}
