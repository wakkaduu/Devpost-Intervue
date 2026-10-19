import { beforeEach, describe, expect, it, vi } from "vitest";
import { audioFileName, isAcceptedAudioType, speechOnly, transcribeAudio, type TranscribeDeps } from "@/lib/transcribe";

const file = new Blob([new Uint8Array(2000)], { type: "audio/webm" });
const deps = (over: Partial<TranscribeDeps> & { groq?: any; gemini?: any } = {}): TranscribeDeps => ({
  groq: vi.fn(async () => "hello from groq"),
  gemini: vi.fn(async () => "hello from gemini"),
  env: { GROQ_API_KEY: "g", GEMINI_API_KEY: "a" },
  timeoutMs: 100,
  ...over,
});

beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));

describe("transcribeAudio", () => {
  it("uses Groq Whisper first", async () => {
    expect(await transcribeAudio(file, deps())).toEqual({ ok: true, text: "hello from groq", provider: "groq" });
  });
  it("falls back to Gemini when Groq fails or hangs", async () => {
    expect(await transcribeAudio(file, deps({ groq: vi.fn(async () => { throw new Error("x"); }) }))).toMatchObject({ provider: "gemini" });
    expect(await transcribeAudio(file, deps({ groq: () => new Promise(() => {}) }))).toMatchObject({ provider: "gemini" });
  });
  it("reports no speech when a provider answers with nothing, instead of trusting a second guess", async () => {
    const d = deps({ groq: vi.fn(async () => "") });
    expect(await transcribeAudio(file, d)).toEqual({ ok: false, reason: "no-speech" });
    expect(d.gemini).not.toHaveBeenCalled();
  });
  it("reports unavailable when every provider fails or none is configured", async () => {
    const boom = vi.fn(async () => { throw new Error("x"); });
    expect(await transcribeAudio(file, deps({ groq: boom, gemini: boom }))).toEqual({ ok: false, reason: "unavailable" });
    expect(await transcribeAudio(file, deps({ env: {} }))).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("helpers", () => {
  it("names the file after its real container", () => {
    expect(audioFileName("audio/webm;codecs=opus")).toBe("answer.webm");
    expect(audioFileName("audio/mp4")).toBe("answer.m4a");
    expect(audioFileName("audio/ogg")).toBe("answer.ogg");
    expect(audioFileName("audio/wav")).toBe("answer.wav");
  });
  it("accepts audio only", () => {
    expect(isAcceptedAudioType("audio/webm")).toBe(true);
    expect(isAcceptedAudioType("video/webm")).toBe(true);
    expect(isAcceptedAudioType("application/pdf")).toBe(false);
    expect(isAcceptedAudioType("text/html")).toBe(false);
  });
});

describe("speechOnly (guards against Whisper inventing words for silence)", () => {
  it("drops segments Whisper itself rates as probably not speech", () => {
    expect(speechOnly({ text: " you", segments: [{ text: " you", no_speech_prob: 0.7 }] })).toBe("");
  });
  it("keeps real speech and joins segments", () => {
    expect(speechOnly({ segments: [{ text: " I led it.", no_speech_prob: 0.01 }, { text: " It worked.", no_speech_prob: 0 }] })).toBe("I led it. It worked.");
  });
  it("keeps the speech around a silent patch", () => {
    expect(speechOnly({ segments: [{ text: " Hello.", no_speech_prob: 0.02 }, { text: " you", no_speech_prob: 0.8 }] })).toBe("Hello.");
  });
  it("falls back to the plain text when there are no segments", () => {
    expect(speechOnly({ text: "  plain text " })).toBe("plain text");
  });
});
