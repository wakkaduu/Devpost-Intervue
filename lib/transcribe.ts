// Server-only: turns recorded audio into text. Groq Whisper first, then Gemini.
import { GoogleGenerativeAI } from "@google/generative-ai";
import { withTimeout } from "@/lib/evaluator";
import { GEMINI_MODEL } from "@/lib/gemini";

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MIN_AUDIO_BYTES = 500;
export const TRANSCRIBE_TIMEOUT_MS = 20_000;

/** Picks a filename extension that matches the real container (iPhones record MP4/AAC, not WebM). */
export function audioFileName(type: string): string {
  const base = (type || "").split(";")[0].toLowerCase();
  if (base.includes("mp4") || base.includes("m4a") || base.includes("aac")) return "answer.m4a";
  if (base.includes("ogg")) return "answer.ogg";
  if (base.includes("wav")) return "answer.wav";
  if (base.includes("mpeg") || base.includes("mp3")) return "answer.mp3";
  return "answer.webm";
}

export function isAcceptedAudioType(type: string): boolean {
  return !type || type.startsWith("audio/") || type.startsWith("video/webm");
}

export async function transcribeWithGroq(file: Blob, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append("file", file, audioFileName(file.type));
  form.append("model", "whisper-large-v3");
  form.append("temperature", "0");
  form.append("response_format", "verbose_json");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Groq Whisper returned HTTP ${res.status}`);
  const data = (await res.json()) as { text?: string; segments?: { text: string; no_speech_prob?: number }[] };
  return speechOnly(data);
}

/** Whisper invents words like "you" for silence. Segments it itself rates as probably-not-speech are dropped. */
export const NO_SPEECH_THRESHOLD = 0.6;
export function speechOnly(data: { text?: string; segments?: { text: string; no_speech_prob?: number }[] }): string {
  if (!data.segments) return (data.text ?? "").trim();
  return data.segments
    .filter((seg) => (seg.no_speech_prob ?? 0) < NO_SPEECH_THRESHOLD)
    .map((seg) => seg.text.trim())
    .join(" ")
    .trim();
}

export async function transcribeWithGemini(file: Blob, apiKey: string): Promise<string> {
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent([
    { inlineData: { mimeType: (file.type || "audio/webm").split(";")[0], data } },
    { text: "Transcribe this spoken interview answer exactly as spoken. Return only the transcript text. If there is no speech, return an empty string." },
  ]);
  return result.response.text().trim();
}

export type TranscribeResult = { ok: true; text: string; provider: "groq" | "gemini" } | { ok: false; reason: "no-speech" | "unavailable" };

export interface TranscribeDeps {
  groq: typeof transcribeWithGroq;
  gemini: typeof transcribeWithGemini;
  env: Record<string, string | undefined>;
  timeoutMs: number;
}

export async function transcribeAudio(
  file: Blob,
  deps: TranscribeDeps = { groq: transcribeWithGroq, gemini: transcribeWithGemini, env: process.env, timeoutMs: TRANSCRIBE_TIMEOUT_MS }
): Promise<TranscribeResult> {
  const attempts: { name: "groq" | "gemini"; run: () => Promise<string> }[] = [];
  if (deps.env.GROQ_API_KEY) attempts.push({ name: "groq", run: () => deps.groq(file, deps.env.GROQ_API_KEY!) });
  if (deps.env.GEMINI_API_KEY) attempts.push({ name: "gemini", run: () => deps.gemini(file, deps.env.GEMINI_API_KEY!) });

  let heardSilence = false;
  for (const attempt of attempts) {
    try {
      const text = await withTimeout(attempt.run(), deps.timeoutMs, attempt.name);
      if (text) return { ok: true, text, provider: attempt.name };
      heardSilence = true; // a provider answered but found no words: don't hide that behind the next one's guess
      break;
    } catch (err) {
      console.warn(`[transcribe] ${attempt.name} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return { ok: false, reason: heardSilence ? "no-speech" : "unavailable" };
}
