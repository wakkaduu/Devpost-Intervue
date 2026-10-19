import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import VoiceAnswer from "@/components/VoiceAnswer";
import AudioMeter from "@/components/AudioMeter";
import FeedbackPanel from "@/components/FeedbackPanel";

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static isTypeSupported = () => true;
  state = "inactive"; mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor() { FakeRecorder.instances.push(this); }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob([new Uint8Array(2000)], { type: "audio/webm" }) });
    this.onstop?.();
  }
}

/** A speech engine that fails the way Chrome without Google's speech service does: "network" straight after start. */
let liveStarts = 0;
class NetworkFailRecognition {
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start() { liveStarts++; setTimeout(() => this.onerror?.({ error: "network" }), 0); }
  stop() {} abort() {}
}
/** Brave: the microphone opens ("Listening" shows) and only then does the browser report that the speech service is unreachable. */
class OpenThenFailRecognition {
  constructor(private code = "network") {}
  onerror: ((e: { error: string }) => void) | null = null;
  onstart: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;
  onend: (() => void) | null = null;
  start() {
    liveStarts++;
    setTimeout(() => { this.onstart?.(); this.onaudiostart?.(); }, 0);
    setTimeout(() => this.onerror?.({ error: this.code }), 40);
  }
  stop() {} abort() {}
}
class DeniedRecognition {
  onerror: ((e: { error: string }) => void) | null = null;
  start() { setTimeout(() => this.onerror?.({ error: "not-allowed" }), 0); }
  stop() {} abort() {}
}

function Harness() {
  const [value, setValue] = useState("");
  return <VoiceAnswer value={value} onChange={setValue} onSpokenSeconds={() => {}} />;
}

const stopTrack = vi.fn();
const mic = (impl?: () => Promise<unknown>) =>
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(impl ?? (async () => ({ getTracks: () => [{ stop: stopTrack }] }))) } });
const transcript = (text: string) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ text }) })));

beforeEach(() => {
  FakeRecorder.instances = [];
  liveStarts = 0;
  stopTrack.mockClear();
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  mic();
  (window as any).SpeechRecognition = NetworkFailRecognition;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as any).SpeechRecognition;
});

const answer = () => screen.getByLabelText("Your answer");

describe("one button: live captions fall back to audio recording by themselves", () => {
  it("when the speech service can't be reached, pressing Start once carries on recording audio, with no second button to find", async () => {
    transcript("I led the migration");
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    // the same single button turns into Stop without any further click
    expect(await screen.findByRole("button", { name: /Stop recording/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record audio/ })).toBeNull();
    expect(screen.getByText(/Recording… speak now/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull(); // nothing to complain about
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: /Stop recording/ }));
    await waitFor(() => expect(answer()).toHaveValue("I led the migration"));
    expect(stopTrack).toHaveBeenCalled(); // the microphone is released
  });

  it("shows 'Starting microphone' straight away while the browser opens it", async () => {
    let release!: (s: unknown) => void;
    mic(() => new Promise((r) => { release = r; }));
    transcript("x");
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    expect(await screen.findByRole("button", { name: /Starting microphone/ })).toBeInTheDocument();
    expect(screen.getByText(/wait for “Recording” before you speak/)).toBeInTheDocument();
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled()); // after the short hand-over pause
    await act(async () => release({ getTracks: () => [{ stop: stopTrack }] }));
    expect(await screen.findByRole("button", { name: /Stop recording/ })).toBeInTheDocument();
  });

  it("after live captions have failed once, later presses go straight to audio without trying them again", async () => {
    transcript("first part");
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Stop recording/ }));
    await waitFor(() => expect(answer()).toHaveValue("first part"));
    expect(liveStarts).toBe(1);
    transcript("second part");
    await userEvent.click(screen.getByRole("button", { name: /Record more/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Stop recording/ }));
    await waitFor(() => expect(answer()).toHaveValue("first part second part"));
    expect(liveStarts).toBe(1);
  });

  it("a browser with no live captions at all starts recording on the first press, and says why words appear later", async () => {
    delete (window as any).SpeechRecognition;
    transcript("hello");
    render(<Harness />);
    expect(await screen.findByText(/can’t show live captions/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    expect(await screen.findByRole("button", { name: /Stop recording/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Stop recording/ }));
    await waitFor(() => expect(answer()).toHaveValue("hello"));
  });

  it("shows the server's message when transcription fails, and typing still works", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: "Transcription is unavailable right now. Please type your answer instead." }) })));
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Stop recording/ }));
    expect(await screen.findByText(/Transcription is unavailable/)).toBeInTheDocument();
    await userEvent.type(answer(), "typed");
    expect(answer()).toHaveValue("typed");
  });

  it("shows 'Transcribing' while the recording is turned into text", async () => {
    let finish!: () => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((r) => { finish = () => r({ ok: true, json: async () => ({ text: "done" }) }); })));
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Stop recording/ }));
    expect(await screen.findByText(/Turning your recording into text/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Transcribing/ })).toBeDisabled();
    await act(async () => finish());
    await waitFor(() => expect(answer()).toHaveValue("done"));
  });
});

describe("the Brave case: Listening shows first, then the speech service turns out to be unreachable", () => {
  it.each([["network"], ["service-not-allowed"], ["language-not-supported"]])("error '%s' after the microphone opened still ends up recording audio, with one press", async (code) => {
    (window as any).SpeechRecognition = class extends OpenThenFailRecognition { constructor() { super(code); } };
    transcript("brave works");
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    // the single press ends up in audio recording (not back at "Start recording", which was the bug)
    await waitFor(() => expect(screen.getByText(/Recording… speak now/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Stop recording/ })).toBeInTheDocument();
    expect(screen.queryByText(/Listening… speak now/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: /Stop recording/ }));
    await waitFor(() => expect(answer()).toHaveValue("brave works"));
  });

  it("an unexpected one-off error does not make the person press Start twice either", async () => {
    (window as any).SpeechRecognition = class extends OpenThenFailRecognition { constructor() { super("bad-grammar"); } };
    transcript("fine");
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    await waitFor(() => expect(screen.getByText(/Recording… speak now/)).toBeInTheDocument());
  });

  it("if the microphone is still busy for a moment after the speech engine lets go, it tries again by itself", async () => {
    (window as any).SpeechRecognition = OpenThenFailRecognition;
    let calls = 0;
    mic(async () => {
      calls++;
      if (calls === 1) throw Object.assign(new Error("busy"), { name: "NotReadableError" });
      return { getTracks: () => [{ stop: stopTrack }] };
    });
    transcript("ok");
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    await waitFor(() => expect(screen.getByText(/Recording… speak now/)).toBeInTheDocument(), { timeout: 3000 });
    expect(calls).toBe(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ending a live recording yourself is not mistaken for a failure that needs rescuing", async () => {
    class WorkingRecognition {
      onstart: any; onaudiostart: any; onend: any; onerror: any; onresult: any;
      start() { liveStarts++; setTimeout(() => { this.onstart?.(); this.onaudiostart?.(); }, 0); }
      stop() { setTimeout(() => this.onend?.(), 0); } abort() {}
    }
    (window as any).SpeechRecognition = WorkingRecognition;
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Stop recording/ }));
    await screen.findByRole("button", { name: /Record more|Start recording/ });
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});

describe("when the microphone itself is the problem", () => {
  it("a denied microphone gets one clear message and typing, not an endless fallback", async () => {
    (window as any).SpeechRecognition = DeniedRecognition;
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Microphone access was denied/);
    expect(screen.queryByRole("button", { name: /recording/i })).toBeNull();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    await userEvent.type(answer(), "typed");
    expect(answer()).toHaveValue("typed");
  });

  it("if audio recording can't open the microphone either, the 'starting' state ends and says why", async () => {
    mic(async () => { throw Object.assign(new Error("x"), { name: "NotAllowedError" }); });
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    expect(await screen.findByText(/Microphone access was denied/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Starting microphone/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Start recording/ })).toBeInTheDocument();
  });

  it("with neither live captions nor audio recording, it is typing only", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Please type your answer/);
    expect(screen.queryByRole("button", { name: /recording/i })).toBeNull();
  });
});

describe("AudioMeter", () => {
  it("grows with the level and is hidden from screen readers", () => {
    const { container, rerender } = render(<AudioMeter level={0} />);
    const heights = () => [...container.querySelectorAll("span > span")].map((b) => parseInt((b as HTMLElement).style.height));
    const quiet = heights();
    rerender(<AudioMeter level={1} />);
    const loud = heights();
    expect(loud.every((h, i) => h > quiet[i])).toBe(true);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("basic feedback notice", () => {
  const base = {
    score: 4, summary: "s", strengths: ["a"], areasForImprovement: ["b"], focusNext: "f", strongerVersion: "v",
    followUpQuestion: "q?", howTheyAnswered: "h", toneAnalysis: "t", questionConnection: "c",
  };
  it("labels basic feedback and offers to retry with the AI", async () => {
    const retry = vi.fn();
    render(<FeedbackPanel feedback={{ ...base, source: "basic" }} onRetry={retry} />);
    expect(screen.getByText("Basic feedback")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try the AI review again" }));
    expect(retry).toHaveBeenCalled();
  });
  it("shows no notice for an AI review", () => {
    render(<FeedbackPanel feedback={{ ...base, source: "ai" }} onRetry={() => {}} />);
    expect(screen.queryByText("Basic feedback")).toBeNull();
  });
});
