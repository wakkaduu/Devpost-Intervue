// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TTS_MODELS, pcmToWav, sampleRateOf, synthesizeSpeech, toWav, type TtsDeps } from "@/lib/tts";

const b64 = (b: Buffer) => b.toString("base64");
const reply = (data: Buffer, mimeType: string) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { data: b64(data), mimeType } }] } }] }) });
const wavOf = (n = 100) => pcmToWav(Buffer.alloc(n), 24000);

function deps(fetchImpl: any, env: Record<string, string | undefined> = { GEMINI_API_KEY: "key" }): TtsDeps & { fetch: any } {
  return { fetch: fetchImpl, env, cache: new Map() } as any;
}

beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));

describe("pcmToWav", () => {
  it("wraps raw 16-bit mono PCM in a valid WAV header", () => {
    const pcm = Buffer.alloc(48000);
    const wav = pcmToWav(pcm, 24000);
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(wav.subarray(8, 12).toString()).toBe("WAVE");
    expect(wav.readUInt32LE(4)).toBe(36 + pcm.length);
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.readUInt32LE(28)).toBe(48000); // bytes per second
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
    expect(wav.length).toBe(44 + pcm.length);
  });
});

describe("toWav", () => {
  it("passes real WAV files through, wraps PCM, and refuses anything else", () => {
    const wav = wavOf();
    expect(toWav(wav, "audio/wav")).toBe(wav);
    expect(toWav(wav, "application/octet-stream")).toBe(wav); // recognised by its RIFF header
    expect(toWav(Buffer.alloc(10), "audio/L16;codec=pcm;rate=16000").readUInt32LE(24)).toBe(16000);
    expect(() => toWav(Buffer.alloc(10), "audio/mpeg")).toThrow(/Unsupported/);
  });
  it("reads the sample rate from the mime type", () => {
    expect(sampleRateOf("audio/l16; rate=24000; channels=1")).toBe(24000);
    expect(sampleRateOf("audio/pcm")).toBe(24000);
  });
});

describe("synthesizeSpeech", () => {
  it("asks the first model for audio with the chosen voice, and sends the question text alone", async () => {
    const f = vi.fn(async () => reply(wavOf(), "audio/wav"));
    const wav = await synthesizeSpeech("Tell me about yourself.", deps(f, { GEMINI_API_KEY: "k", GEMINI_TTS_VOICE: "Puck" }));
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/models/${DEFAULT_TTS_MODELS[0]}:generateContent`);
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0].text).toBe("Tell me about yourself."); // no extra instructions that would be read aloud
    expect(body.generationConfig.responseModalities).toEqual(["AUDIO"]);
    expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe("Puck");
  });

  it("converts PCM replies to WAV", async () => {
    const f = vi.fn(async () => reply(Buffer.alloc(2000), "audio/L16;codec=pcm;rate=24000"));
    const wav = await synthesizeSpeech("Hello", deps(f));
    expect(wav.length).toBe(2044);
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
  });

  it("falls back to the next model when one fails or returns no audio", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce(reply(wavOf(), "audio/wav"));
    await synthesizeSpeech("Hello", deps(f));
    expect(f).toHaveBeenCalledTimes(2);
    expect((f.mock.calls[1] as unknown as [string])[0]).toContain(DEFAULT_TTS_MODELS[1]);
    const g = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [] }) }).mockResolvedValueOnce(reply(wavOf(), "audio/wav"));
    await synthesizeSpeech("Again", deps(g));
    expect(g).toHaveBeenCalledTimes(2);
  });

  it("tries a configured model first", async () => {
    const f = vi.fn(async () => reply(wavOf(), "audio/wav"));
    await synthesizeSpeech("Hello", deps(f, { GEMINI_API_KEY: "k", GEMINI_TTS_MODEL: "my-model" }));
    expect((f.mock.calls[0] as unknown as [string])[0]).toContain("/models/my-model:");
  });

  it("throws when every model fails or no key is set", async () => {
    const f = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    await expect(synthesizeSpeech("Hello", deps(f))).rejects.toThrow(/500/);
    expect(f).toHaveBeenCalledTimes(DEFAULT_TTS_MODELS.length);
    await expect(synthesizeSpeech("Hello", deps(vi.fn(), {}))).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it("serves a repeated question from memory, and keeps voices apart", async () => {
    const f = vi.fn(async () => reply(wavOf(), "audio/wav"));
    const d = deps(f);
    await synthesizeSpeech("Same question", d);
    await synthesizeSpeech("Same question", d);
    expect(f).toHaveBeenCalledTimes(1);
    d.env.GEMINI_TTS_VOICE = "Charon";
    await synthesizeSpeech("Same question", d);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures", async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const d = deps(f);
    await expect(synthesizeSpeech("Q", d)).rejects.toThrow();
    f.mockResolvedValue(reply(wavOf(), "audio/wav"));
    await expect(synthesizeSpeech("Q", d)).resolves.toBeDefined();
  });

  it("keeps only the most recent 60 questions in memory", async () => {
    const f = vi.fn(async () => reply(wavOf(), "audio/wav"));
    const d = deps(f);
    for (let i = 0; i < 70; i++) await synthesizeSpeech(`Question ${i}`, d);
    expect(d.cache.size).toBe(60);
    expect(d.cache.has("Kore|Question 0")).toBe(false);
    expect(d.cache.has("Kore|Question 69")).toBe(true);
  });
});
