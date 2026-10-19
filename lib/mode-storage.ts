// The Voice/Written choice is remembered in the browser between visits.
export type PracticeMode = "mic" | "typed";

export const MODE_KEY = "intervue_last_mode";
export const DEFAULT_MODE: PracticeMode = "mic";

export function loadMode(): PracticeMode {
  try {
    const value = window.localStorage.getItem(MODE_KEY);
    return value === "typed" || value === "mic" ? value : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function saveMode(mode: PracticeMode): void {
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Storage can be blocked (private windows); the app still works without it.
  }
}
