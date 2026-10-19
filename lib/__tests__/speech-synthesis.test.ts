import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MUTED_KEY, SPEED_KEY, clampSpeed, getInterviewerMuted, getInterviewerSpeed, pickVoice, setInterviewerMuted,
  setInterviewerSpeed, speak,
} from "@/lib/speech-synthesis";

const voice = (name: string, lang: string, isDefault = false) => ({ name, lang, default: isDefault }) as SpeechSynthesisVoice;

beforeEach(() => window.localStorage.clear());

describe("preferences", () => {
  it("defaults to unmuted at normal speed", () => {
    expect(getInterviewerMuted()).toBe(false);
    expect(getInterviewerSpeed()).toBe(1);
  });
  it("remembers mute and speed", () => {
    setInterviewerMuted(true);
    setInterviewerSpeed(1.25);
    expect(window.localStorage.getItem(MUTED_KEY)).toBe("true");
    expect(getInterviewerMuted()).toBe(true);
    expect(getInterviewerSpeed()).toBe(1.25);
  });
  it("keeps speed in range and ignores garbage", () => {
    expect(clampSpeed(5)).toBe(1.5);
    expect(clampSpeed(0.1)).toBe(0.75);
    expect(clampSpeed(NaN)).toBe(1);
    window.localStorage.setItem(SPEED_KEY, "banana");
    expect(getInterviewerSpeed()).toBe(1);
  });
  it("survives blocked storage", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(getInterviewerMuted()).toBe(false);
    expect(getInterviewerSpeed()).toBe(1);
    expect(() => setInterviewerMuted(true)).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});

describe("pickVoice", () => {
  it("returns null with no voices, and for no English voice (the browser default is better than a foreign one)", () => {
    expect(pickVoice([])).toBeNull();
    expect(pickVoice([voice("Amelie", "fr-FR")])).toBeNull();
  });
  it("prefers a natural-sounding English voice", () => {
    expect(pickVoice([voice("Basic", "en-US"), voice("Google US English", "en-US"), voice("Fred", "en-GB")])?.name).toBe("Google US English");
  });
  it("then US English, then UK English, then the default", () => {
    expect(pickVoice([voice("A", "en-GB"), voice("B", "en-US")])?.name).toBe("B");
    expect(pickVoice([voice("A", "en-AU"), voice("B", "en-GB")])?.name).toBe("B");
    expect(pickVoice([voice("A", "en-AU"), voice("B", "en-IN", true)])?.name).toBe("B");
  });
  it("skips espeak-style variants such as English+Adam when a plain voice exists", () => {
    expect(pickVoice([voice("English+Adam", "en-US"), voice("English (America)", "en-US")])?.name).toBe("English (America)");
    expect(pickVoice([voice("English+Adam", "en-US")])?.name).toBe("English+Adam");
  });
  it("accepts en_US spelling", () => {
    expect(pickVoice([voice("X", "en_US")])?.name).toBe("X");
  });
});

describe("speak", () => {
  let synth: { speak: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn>; getVoices: () => SpeechSynthesisVoice[] };
  let utterances: any[];
  beforeEach(() => {
    utterances = [];
    synth = { speak: vi.fn((u) => utterances.push(u)), cancel: vi.fn(), getVoices: () => [voice("Google US English", "en-US")] };
    vi.stubGlobal("SpeechSynthesisUtterance", class { text: string; rate = 1; lang = ""; voice: any; onstart: any; onend: any; onerror: any; constructor(t: string) { this.text = t; } });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: synth });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).speechSynthesis;
  });

  it("cancels earlier speech, then speaks with the chosen voice and speed", () => {
    expect(speak("Tell me about yourself", 1.25)).toBe(true);
    expect(synth.cancel).toHaveBeenCalledBefore(synth.speak);
    expect(utterances[0]).toMatchObject({ text: "Tell me about yourself", rate: 1.25, lang: "en-US" });
    expect(utterances[0].voice.name).toBe("Google US English");
  });
  it("reports start and end", () => {
    const onStart = vi.fn(), onEnd = vi.fn();
    speak("Hi", 1, { onStart, onEnd });
    utterances[0].onstart();
    utterances[0].onend();
    expect(onStart).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalled();
  });
  it("does not treat cancelling its own speech as an error, and flags a blocked autoplay", () => {
    const onError = vi.fn();
    speak("Hi", 1, { onError });
    utterances[0].onerror({ error: "canceled" });
    utterances[0].onerror({ error: "interrupted" });
    expect(onError).not.toHaveBeenCalled();
    utterances[0].onerror({ error: "not-allowed" });
    expect(onError).toHaveBeenLastCalledWith(true);
    utterances[0].onerror({ error: "synthesis-failed" });
    expect(onError).toHaveBeenLastCalledWith(false);
  });
  it("says nothing for blank text, and reports unsupported browsers", () => {
    expect(speak("   ", 1)).toBe(false);
    delete (window as any).speechSynthesis;
    expect(speak("Hello", 1)).toBe(false);
  });
});
