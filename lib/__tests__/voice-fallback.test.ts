import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchQuestionAudio, prefetchQuestionAudio, speakFromServer, stopServerSpeech } from "@/lib/server-voice";
import { speakQuestion, stopAllSpeech } from "@/lib/interviewer-voice";
import { browserVoiceKnownBroken, browserVoiceUsable } from "@/lib/speech-synthesis";

class FakeAudio {
  static instances: FakeAudio[] = [];
  static playError: Error | null = null;
  playbackRate = 1; paused = false;
  onplaying: (() => void) | null = null; onended: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(public src: string) { FakeAudio.instances.push(this); }
  async play() { if (FakeAudio.playError) throw FakeAudio.playError; setTimeout(() => this.onplaying?.(), 0); }
  pause() { this.paused = true; }
  finish() { this.onended?.(); }
}

let fetchMock: ReturnType<typeof vi.fn>;
let counter = 0;
const ok = () => ({ ok: true, status: 200, blob: async () => new Blob(["RIFFxxxx"]) });
const q = () => `Question number ${++counter}`;

beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudio.playError = null;
  fetchMock = vi.fn(async () => ok());
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => `blob:fake-${Math.random()}` }));
  window.sessionStorage.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { stopAllSpeech(); vi.unstubAllGlobals(); });

const setVoices = (voices: unknown[], fail?: string) => {
  const synth: any = {
    getVoices: () => voices, cancel: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
    speak: vi.fn((u: any) => setTimeout(() => (fail ? u.onerror?.({ error: fail }) : u.onend?.()), 0)),
  };
  Object.defineProperty(window, "speechSynthesis", { configurable: true, writable: true, value: synth });
  return synth;
};

describe("server voice", () => {
  it("fetches a question's audio once, however many times it is asked for", async () => {
    const t = q();
    const [a, b] = await Promise.all([fetchQuestionAudio(t), fetchQuestionAudio(t)]);
    expect(a).toBe(b);
    prefetchQuestionAudio(t);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetchMock.mock.calls[0] as any)[1].body)).toEqual({ text: t });
  });

  it("does not remember a failure, so the next press tries again", async () => {
    const t = q();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502 });
    await expect(fetchQuestionAudio(t)).rejects.toThrow(/502/);
    await expect(fetchQuestionAudio(t)).resolves.toMatch(/^blob:/);
  });

  it("plays at the chosen speed and reports loading, start and end", async () => {
    const events: string[] = [];
    await speakFromServer(q(), 1.25, { onLoading: (l) => events.push(`loading:${l}`), onStart: () => events.push("start"), onEnd: () => events.push("end") });
    await new Promise((r) => setTimeout(r, 5));
    FakeAudio.instances[0].finish();
    expect(FakeAudio.instances[0].playbackRate).toBe(1.25);
    expect(events).toEqual(["loading:true", "loading:false", "start", "end"]);
  });

  it("a stop while the audio is still being fetched means it never plays", async () => {
    let release!: () => void;
    fetchMock.mockImplementationOnce(() => new Promise((r) => { release = () => r(ok()); }));
    const p = speakFromServer(q(), 1, {});
    stopServerSpeech();
    release();
    await p;
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("a newer request replaces an older one", async () => {
    await speakFromServer(q(), 1);
    await speakFromServer(q(), 1);
    expect(FakeAudio.instances[0].paused).toBe(true);
    expect(FakeAudio.instances).toHaveLength(2);
  });

  it("reports a failed fetch, and a click-needed autoplay block differently", async () => {
    const onError = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502 });
    await speakFromServer(q(), 1, { onError });
    expect(onError).toHaveBeenLastCalledWith(false);
    FakeAudio.playError = Object.assign(new Error("blocked"), { name: "NotAllowedError" });
    await speakFromServer(q(), 1, { onError });
    expect(onError).toHaveBeenLastCalledWith(true);
  });
});

describe("browserVoiceUsable", () => {
  it("is true with a voice, false with none (after a short wait), and false once marked broken", async () => {
    setVoices([{ name: "x", lang: "en-US" }]);
    expect(await browserVoiceUsable()).toBe(true);
    setVoices([]);
    expect(await browserVoiceUsable(20)).toBe(false);
    window.sessionStorage.setItem("intervue_browser_voice_broken", "true");
    setVoices([{ name: "x", lang: "en-US" }]);
    expect(await browserVoiceUsable()).toBe(false);
  });
  it("is false when the browser has no speech at all", async () => {
    delete (window as any).speechSynthesis;
    expect(await browserVoiceUsable()).toBe(false);
  });
});

describe("speakQuestion", () => {
  it("uses the browser's voice when it has one, with no network call", async () => {
    const synth = setVoices([{ name: "Google US English", lang: "en-US" }]);
    const onSource = vi.fn();
    await speakQuestion(q(), 1, { onSource });
    expect(synth.speak).toHaveBeenCalled();
    expect(onSource).toHaveBeenCalledWith("browser");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the server's voice when the browser has no voices (Brave on Linux)", async () => {
    const synth = setVoices([]);
    const onSource = vi.fn();
    const t = q();
    await speakQuestion(t, 1, { onSource });
    expect(synth.speak).not.toHaveBeenCalled();
    expect(onSource).toHaveBeenCalledWith("server");
    expect(JSON.parse((fetchMock.mock.calls[0] as any)[1].body).text).toBe(t);
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it("when the browser says it can speak but fails ('synthesis-failed'), switches to the server and remembers", async () => {
    setVoices([{ name: "x", lang: "en-US" }], "synthesis-failed");
    const onError = vi.fn();
    await speakQuestion(q(), 1, { onError });
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    expect(onError).not.toHaveBeenCalled(); // the person never sees an error: the server voice took over
    expect(browserVoiceKnownBroken()).toBe(true);
    // next time it goes straight to the server without trying the browser
    const synth = setVoices([{ name: "x", lang: "en-US" }], "synthesis-failed");
    await speakQuestion(q(), 1, {});
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("a blocked autoplay in the browser is not mistaken for a broken voice", async () => {
    setVoices([{ name: "x", lang: "en-US" }], "not-allowed");
    const onError = vi.fn();
    await speakQuestion(q(), 1, { onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(true));
    expect(browserVoiceKnownBroken()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stopping cancels a request that is still waiting for the browser's voices", async () => {
    setVoices([]);
    const p = speakQuestion(q(), 1, {});
    stopAllSpeech();
    await p;
    expect(FakeAudio.instances).toHaveLength(0);
  });
});
