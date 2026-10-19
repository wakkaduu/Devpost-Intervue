import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InterviewerVoiceControls from "@/components/InterviewerVoiceControls";
import LiveDeliveryHUD from "@/components/LiveDeliveryHUD";
import MicCheck from "@/components/MicCheck";
import { MUTED_KEY, SPEED_KEY } from "@/lib/speech-synthesis";

// ── fake text-to-speech ──
let utterances: any[];
let synth: { speak: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn>; getVoices: () => any[]; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
function installSynth() {
  utterances = [];
  synth = { speak: vi.fn((u) => utterances.push(u)), cancel: vi.fn(), getVoices: () => [{ name: "Test Voice", lang: "en-US", default: true }], addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal("SpeechSynthesisUtterance", class { text: string; rate = 1; lang = ""; onstart: any; onend: any; onerror: any; constructor(t: string) { this.text = t; } });
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: synth });
}
const removeSynth = () => { delete (window as any).speechSynthesis; vi.unstubAllGlobals(); };

beforeEach(() => window.localStorage.clear());
afterEach(removeSynth);

describe("InterviewerVoiceControls", () => {
  it("reads a new question aloud automatically", async () => {
    installSynth();
    render(<InterviewerVoiceControls text="Tell me about a conflict" />);
    await waitFor(() => expect(utterances).toHaveLength(1));
    expect(utterances[0].text).toBe("Tell me about a conflict");
  });

  it("reads the next question when the text changes, and stops the old one", async () => {
    installSynth();
    const { rerender } = render(<InterviewerVoiceControls text="First" />);
    await waitFor(() => expect(utterances).toHaveLength(1));
    rerender(<InterviewerVoiceControls text="Second" />);
    await waitFor(() => expect(utterances.map((u) => u.text)).toEqual(["First", "Second"]));
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("does not auto-read when muted, but Listen still works", async () => {
    installSynth();
    window.localStorage.setItem(MUTED_KEY, "true");
    render(<InterviewerVoiceControls text="Hello there" />);
    expect(await screen.findByRole("button", { name: "Auto-read: off" })).toBeInTheDocument();
    expect(utterances).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: /Listen/ }));
    expect(utterances).toHaveLength(1);
  });

  it("muting is remembered and silences what is being said", async () => {
    installSynth();
    render(<InterviewerVoiceControls text="Hello there" />);
    await waitFor(() => expect(utterances).toHaveLength(1));
    synth.cancel.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Auto-read: on" }));
    expect(window.localStorage.getItem(MUTED_KEY)).toBe("true");
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("speed is remembered and used", async () => {
    installSynth();
    window.localStorage.setItem(MUTED_KEY, "true");
    render(<InterviewerVoiceControls text="Hello there" />);
    await userEvent.selectOptions(await screen.findByLabelText("Speed"), "1.5");
    expect(window.localStorage.getItem(SPEED_KEY)).toBe("1.5");
    await userEvent.click(screen.getByRole("button", { name: /Listen/ }));
    expect(utterances[0].rate).toBe(1.5);
  });

  it("stays quiet while paused (recording), and stops speech when recording starts", async () => {
    installSynth();
    const { rerender } = render(<InterviewerVoiceControls text="Hello there" paused />);
    await screen.findByRole("button", { name: /Listen/ });
    expect(utterances).toHaveLength(0);
    rerender(<InterviewerVoiceControls text="Hello there" paused={false} />);
    synth.cancel.mockClear();
    rerender(<InterviewerVoiceControls text="Hello there" paused />);
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("explains a blocked autoplay and points to the Listen button", async () => {
    installSynth();
    render(<InterviewerVoiceControls text="Hello there" />);
    await waitFor(() => expect(utterances).toHaveLength(1));
    act(() => utterances[0].onerror({ error: "not-allowed" }));
    expect(await screen.findByText(/Press Listen/)).toBeInTheDocument();
  });

});

describe("InterviewerVoiceControls in a browser with no voice (Brave on Linux)", () => {
  class FakeAudio {
    static instances: FakeAudio[] = [];
    playbackRate = 1; onplaying: any; onended: any; onerror: any;
    constructor(public src: string) { FakeAudio.instances.push(this); }
    async play() { setTimeout(() => this.onplaying?.(), 0); }
    pause() {}
  }
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    FakeAudio.instances = [];
    // the browser has the speech API but no voices behind it, and speaking fails
    Object.defineProperty(window, "speechSynthesis", { configurable: true, writable: true, value: { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [], addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    fetchMock = vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(["RIFF"]) }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:fake" }));
    window.localStorage.setItem(MUTED_KEY, "true"); // no auto-read, so each step below is the person's own click
  });

  it("Listen speaks the question from the server instead of showing an error", async () => {
    render(<InterviewerVoiceControls text="Tell me about a conflict you resolved." />);
    await userEvent.click(await screen.findByRole("button", { name: /Listen/ }));
    await waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    expect(JSON.parse((fetchMock.mock.calls[0] as any)[1].body).text).toBe("Tell me about a conflict you resolved.");
    expect(screen.queryByText(/Couldn.t read the question aloud/)).toBeNull();
    expect(await screen.findByRole("button", { name: /Stop/ })).toBeInTheDocument();
  });

  it("shows 'Preparing voice…' while the audio is on its way, and Stop cancels it", async () => {
    let release!: () => void;
    fetchMock.mockImplementationOnce(() => new Promise((r) => { release = () => r({ ok: true, status: 200, blob: async () => new Blob(["RIFF"]) }); }));
    render(<InterviewerVoiceControls text="Describe a deadline." />);
    await userEvent.click(await screen.findByRole("button", { name: /Listen/ }));
    expect(await screen.findByRole("button", { name: /Preparing voice/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Preparing voice/ }));
    expect(await screen.findByRole("button", { name: /Listen/ })).toBeInTheDocument();
    release();
    await new Promise((r) => setTimeout(r, 20));
    expect(FakeAudio.instances).toHaveLength(0); // cancelled before it could play
  });

  it("uses the chosen speed", async () => {
    window.localStorage.setItem(SPEED_KEY, "1.5");
    render(<InterviewerVoiceControls text="Explain a failure." />);
    await userEvent.click(await screen.findByRole("button", { name: /Listen/ }));
    await waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    expect(FakeAudio.instances[0].playbackRate).toBe(1.5);
  });

  it("fetches the next question ahead of time, so reading it aloud later is instant", async () => {
    window.localStorage.removeItem(MUTED_KEY);
    render(<InterviewerVoiceControls text="First question here." upcoming="Second question here." />);
    await waitFor(() => expect(fetchMock.mock.calls.map((c: any) => JSON.parse(c[1].body).text)).toContain("Second question here."));
  });

  it("says so, kindly, if even the server's voice fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    render(<InterviewerVoiceControls text="Another failure question." />);
    await userEvent.click(await screen.findByRole("button", { name: /Listen/ }));
    expect(await screen.findByText(/Couldn’t read the question aloud. You can still read it on screen/)).toBeInTheDocument();
  });
});

describe("LiveDeliveryHUD", () => {
  const words = (n: number) => Array(n).fill("word").join(" ");
  it("waits for enough speech before showing numbers", () => {
    render(<LiveDeliveryHUD transcript="hi there" seconds={2} />);
    expect(screen.getByText(/Measuring your pace/)).toBeInTheDocument();
  });
  it("shows pace with a label (not colour alone) and the filler count", () => {
    render(<LiveDeliveryHUD transcript={`um ${words(19)} like`} seconds={10} />);
    expect(screen.getByText("126")).toBeInTheDocument(); // 21 words in 10 seconds
    expect(screen.getByText("Good pace")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/filler words/)).toBeInTheDocument();
  });
  it("can be hidden and shown again", async () => {
    render(<LiveDeliveryHUD transcript={words(30)} seconds={10} />);
    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByText(/words\/min/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText(/words\/min/)).toBeInTheDocument();
  });
});

describe("MicCheck", () => {
  let trackStop: ReturnType<typeof vi.fn>;
  let level = 128;
  let frames: (() => void)[];
  beforeEach(() => {
    trackStop = vi.fn();
    frames = [];
    level = 128;
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => (frames.push(cb), frames.length));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("AudioContext", class {
      close = vi.fn(async () => {});
      createAnalyser() { return { fftSize: 0, getByteTimeDomainData: (a: Uint8Array) => a.fill(level) }; }
      createMediaStreamSource() { return { connect: vi.fn() }; }
    });
  });
  const mic = (impl: () => Promise<unknown>) =>
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(impl) } });
  const runFrames = (n: number) => { for (let i = 0; i < n; i++) act(() => frames.shift()?.()); };

  it("says what to do, then confirms when it hears you", async () => {
    mic(async () => ({ getTracks: () => [{ stop: trackStop }] }));
    render(<MicCheck />);
    expect(screen.getByText(/testing, one, two, three/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Test my microphone" }));
    await screen.findByText(/Listening/);
    level = 128 + 40;
    runFrames(12);
    expect(await screen.findByText(/We can hear you/)).toBeInTheDocument();
    expect(Number(screen.getByRole("meter").getAttribute("aria-valuenow"))).toBeGreaterThan(30);
  });

  it("keeps listening if the room is silent", async () => {
    mic(async () => ({ getTracks: () => [{ stop: trackStop }] }));
    render(<MicCheck />);
    await userEvent.click(screen.getByRole("button", { name: "Test my microphone" }));
    await screen.findByText(/Listening/);
    runFrames(20);
    expect(screen.queryByText(/We can hear you/)).toBeNull();
  });

  it.each([
    ["NotAllowedError", /access was denied/],
    ["NotFoundError", /No microphone was found/],
    ["SomethingElse", /couldn’t start the microphone/],
  ])("explains a %s failure and offers another try", async (name, text) => {
    mic(async () => { throw Object.assign(new Error("x"), { name }); });
    render(<MicCheck />);
    await userEvent.click(screen.getByRole("button", { name: "Test my microphone" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("releases the microphone when the test is stopped or the page is left", async () => {
    mic(async () => ({ getTracks: () => [{ stop: trackStop }] }));
    const { unmount } = render(<MicCheck />);
    await userEvent.click(screen.getByRole("button", { name: "Test my microphone" }));
    await userEvent.click(await screen.findByRole("button", { name: "Stop test" }));
    expect(trackStop).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Test my microphone" }));
    await screen.findByText(/Listening/);
    unmount();
    expect(trackStop).toHaveBeenCalledTimes(2);
  });
});
