// Server-only: turns an interview question into spoken audio with Gemini's text-to-speech.
// This is the fallback for browsers that cannot speak (for example Brave or Chromium on Linux with no system voices).

/** Tried in order. The second is an older model kept as a safety net in case the first is retired. */
export const DEFAULT_TTS_MODELS = ["gemini-3.8-flash-lite-tts", "gemini-2.5-flash-preview-tts"];
export const DEFAULT_TTS_VOICE = "Kore";
export const TTS_TIMEOUT_MS = 25_000;
const CACHE_LIMIT = 60;

/** Raw 16-bit little-endian mono PCM, which is what Gemini returns for some models, wrapped as a playable WAV file. */
export function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM header size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28); // byte rate
  header.writeUInt16LE(channels * 2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function sampleRateOf(mime: string): number {
  const m = /rate=(\d{4,6})/i.exec(mime);
  return m ? Number(m[1]) : 24000;
}

/** Whatever audio shape the model returned, as a WAV file. Throws if it isn't audio. */
export function toWav(data: Buffer, mime: string): Buffer {
  if (/audio\/(x-)?wav/i.test(mime) || data.subarray(0, 4).toString() === "RIFF") return data;
  if (/audio\/l16|pcm/i.test(mime)) return pcmToWav(data, sampleRateOf(mime));
  throw new Error(`Unsupported audio type: ${mime}`);
}

export interface TtsDeps {
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  cache: Map<string, Buffer>;
}

const sharedCache = new Map<string, Buffer>();
const defaultDeps = (): TtsDeps => ({ fetch, env: process.env, cache: sharedCache });

async function requestModel(model: string, text: string, voice: string, apiKey: string, doFetch: typeof fetch): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
  try {
    const res = await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });
    if (!res.ok) throw new Error(`${model} returned HTTP ${res.status}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
    const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!inline?.data) throw new Error(`${model} returned no audio`);
    return toWav(Buffer.from(inline.data, "base64"), inline.mimeType ?? "audio/wav");
  } finally {
    clearTimeout(timer);
  }
}

/** Speech for `text` as WAV audio. Repeated requests for the same text are served from memory. Throws if every model fails. */
export async function synthesizeSpeech(text: string, deps: TtsDeps = defaultDeps()): Promise<Buffer> {
  const apiKey = deps.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const voice = deps.env.GEMINI_TTS_VOICE || DEFAULT_TTS_VOICE;
  const models = deps.env.GEMINI_TTS_MODEL ? [deps.env.GEMINI_TTS_MODEL, ...DEFAULT_TTS_MODELS] : DEFAULT_TTS_MODELS;

  const key = `${voice}|${text}`;
  const hit = deps.cache.get(key);
  if (hit) {
    deps.cache.delete(key); // move to the newest position
    deps.cache.set(key, hit);
    return hit;
  }

  let lastError: unknown;
  for (const model of models) {
    try {
      const wav = await requestModel(model, text, voice, apiKey, deps.fetch);
      deps.cache.set(key, wav);
      while (deps.cache.size > CACHE_LIMIT) deps.cache.delete(deps.cache.keys().next().value as string);
      return wav;
    } catch (err) {
      lastError = err;
      console.warn(`[speak] ${model} failed:`, err instanceof Error ? err.message : err);
    }
  }
  throw lastError;
}
