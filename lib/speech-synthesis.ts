// The interviewer's voice: the browser's built-in text-to-speech, plus the two saved preferences.

export const MUTED_KEY = "intervue_interviewer_muted";
export const SPEED_KEY = "intervue_interviewer_speed";
export const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function getInterviewerMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTED_KEY) === "true";
  } catch {
    return false;
  }
}

export function setInterviewerMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTED_KEY, String(muted));
  } catch {
    // Blocked storage: the preference just won't be remembered.
  }
}

export function clampSpeed(value: number): number {
  return Number.isFinite(value) ? Math.max(0.75, Math.min(1.5, value)) : 1;
}

export function getInterviewerSpeed(): number {
  try {
    const raw = window.localStorage.getItem(SPEED_KEY);
    return raw === null ? 1 : clampSpeed(parseFloat(raw));
  } catch {
    return 1;
  }
}

export function setInterviewerSpeed(speed: number): void {
  try {
    window.localStorage.setItem(SPEED_KEY, String(clampSpeed(speed)));
  } catch {
    // ignore
  }
}

/**
 * Picks a plain English voice. Order: a named natural-sounding voice, then US English, then UK English,
 * then the system default, then any English voice. "Plain" skips espeak-style variants such as
 * "English+Adam", which Linux can list by the hundred.
 */
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  if (english.length === 0) return null; // better the browser's default voice than a non-English one
  const pool = english.filter((v) => !v.name.includes("+"));
  const candidates = pool.length > 0 ? pool : english;
  for (const keyword of ["natural", "neural", "google", "samantha", "daniel"]) {
    const match = candidates.find((v) => v.name.toLowerCase().includes(keyword));
    if (match) return match;
  }
  return (
    candidates.find((v) => /^en[-_]US$/i.test(v.lang)) ||
    candidates.find((v) => /^en[-_]GB$/i.test(v.lang)) ||
    candidates.find((v) => v.default) ||
    candidates[0]
  );
}

export function stopSpeaking(): void {
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

export interface SpeakHandlers {
  onStart?: () => void;
  onEnd?: () => void;
  /** `blocked` means the browser refused to speak without a click; the Listen button will work. */
  onError?: (blocked: boolean) => void;
}

/** Speaks text aloud, replacing anything already being spoken. Returns false when speech isn't available. */
export function speak(text: string, rate: number, handlers: SpeakHandlers = {}): boolean {
  if (!isSpeechSynthesisSupported() || !text.trim()) return false;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = clampSpeed(rate);
    utterance.lang = "en-US";
    const voice = pickVoice(synth.getVoices());
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.onstart = () => handlers.onStart?.();
    utterance.onend = () => handlers.onEnd?.();
    utterance.onerror = (e) => {
      // Cancelling our own speech to start new speech is not an error.
      if (e.error === "canceled" || e.error === "interrupted") return;
      handlers.onError?.(e.error === "not-allowed");
    };
    synth.speak(utterance);
    return true;
  } catch {
    handlers.onError?.(false);
    return false;
  }
}
