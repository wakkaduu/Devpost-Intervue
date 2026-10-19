import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import VoiceAnswer from "@/components/VoiceAnswer";
import { READY_FALLBACK_MS, STARTUP_TIMEOUT_MS, STOP_GRACE_MS } from "@/hooks/useSpeechRecognition";

class FakeRecognition {
  static last: FakeRecognition;
  continuous = false; interimResults = false; lang = "";
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  start = vi.fn(); stop = vi.fn(); abort = vi.fn();
  constructor() { FakeRecognition.last = this; }
  /** What Chrome does once the microphone is really capturing. */
  live() { this.onstart?.(); this.onaudiostart?.(); }
  say(text: string, isFinal = true) {
    this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })] });
  }
}

function Harness({ onSeconds = () => {}, onRecording = () => {} }: { onSeconds?: (n: number) => void; onRecording?: (r: boolean) => void }) {
  const [value, setValue] = useState("");
  return <VoiceAnswer value={value} onChange={setValue} onSpokenSeconds={onSeconds} onRecordingChange={onRecording} />;
}

beforeEach(() => { (window as any).SpeechRecognition = FakeRecognition; });
afterEach(() => { delete (window as any).SpeechRecognition; vi.useRealTimers(); });

const start = () => userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
const answer = () => screen.getByLabelText("Your answer");

describe("starting up", () => {
  it("shows 'Starting microphone' at once and only says Listening when the microphone is really live", async () => {
    render(<Harness />);
    await start();
    expect(screen.getByRole("button", { name: /Starting microphone/ })).toBeInTheDocument();
    expect(screen.getByText(/wait for “Listening” before you speak/)).toBeInTheDocument();
    expect(screen.queryByText(/Listening… speak now/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Stop recording/ })).toBeNull();
    act(() => FakeRecognition.last.live());
    expect(screen.getByText(/Listening… speak now/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stop recording/ })).toBeInTheDocument();
    expect(screen.queryByText(/wait for “Listening”/)).toBeNull();
  });

  it("the first words arriving also count as live, for engines that don't announce it", async () => {
    render(<Harness />);
    await start();
    act(() => FakeRecognition.last.say("hello there", false));
    expect(screen.getByText(/Listening… speak now/)).toBeInTheDocument();
  });

  it("engines that only report 'started' are treated as live after a short moment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Harness />);
    await start();
    act(() => FakeRecognition.last.onstart?.());
    expect(screen.queryByText(/Listening… speak now/)).toBeNull();
    act(() => { vi.advanceTimersByTime(READY_FALLBACK_MS + 50); });
    expect(screen.getByText(/Listening… speak now/)).toBeInTheDocument();
  });

  it("gives up with a clear message if the microphone never starts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Harness />);
    await start();
    act(() => { vi.advanceTimersByTime(STARTUP_TIMEOUT_MS + 50); });
    expect(screen.getByRole("alert")).toHaveTextContent(/microphone didn't start/);
    expect(screen.getByRole("button", { name: /Start recording/ })).toBeInTheDocument();
  });

  it("can be cancelled while starting", async () => {
    render(<Harness />);
    await start();
    await userEvent.click(screen.getByRole("button", { name: /Starting microphone/ }));
    expect(FakeRecognition.last.abort).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Start recording/ })).toBeInTheDocument();
  });

  it("speaking time starts when the microphone is live, not when the button was pressed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const seconds = vi.fn();
    render(<Harness onSeconds={seconds} />);
    await start();
    act(() => { vi.advanceTimersByTime(2500); }); // engine still connecting
    expect(seconds).not.toHaveBeenCalled();
    act(() => FakeRecognition.last.live());
    act(() => { vi.advanceTimersByTime(3100); });
    expect(seconds).toHaveBeenLastCalledWith(3);
  });

  it("tells the interviewer's voice to stay quiet from the moment you press the button", async () => {
    const onRecording = vi.fn();
    render(<Harness onRecording={onRecording} />);
    await start();
    expect(onRecording).toHaveBeenLastCalledWith(true);
  });
});

describe("recording and stopping", () => {
  it("shows a live transcript, then keeps it as the answer", async () => {
    render(<Harness />);
    await start();
    act(() => FakeRecognition.last.live());
    act(() => FakeRecognition.last.say("I led the migration", true));
    act(() => FakeRecognition.last.say("and then we", false));
    expect(screen.getByText("and then we")).toBeInTheDocument(); // interim text
    expect(answer()).toHaveValue("I led the migration");
    await userEvent.click(screen.getByRole("button", { name: /Stop recording/ }));
    expect(FakeRecognition.last.stop).toHaveBeenCalled();
    act(() => FakeRecognition.last.onend?.());
    expect(answer()).not.toHaveAttribute("readonly");
    expect(answer()).toHaveValue("I led the migration");
  });

  it("keeps the last words that arrive just after Stop is pressed", async () => {
    render(<Harness />);
    await start();
    act(() => FakeRecognition.last.live());
    act(() => FakeRecognition.last.say("first sentence.", true));
    await userEvent.click(screen.getByRole("button", { name: /Stop recording/ }));
    // Stop was pressed, but the engine still delivers what you said a moment ago
    expect(screen.getByRole("button", { name: /Finishing/ })).toBeDisabled();
    expect(screen.getByText(/Finishing your last words/)).toBeInTheDocument();
    act(() => FakeRecognition.last.say("and my final words.", true));
    act(() => FakeRecognition.last.onend?.());
    expect(answer()).toHaveValue("first sentence. and my final words.");
    expect(screen.getByRole("button", { name: /Record more/ })).toBeInTheDocument();
  });

  it("does not hang if the engine never reports the end", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Harness />);
    await start();
    act(() => FakeRecognition.last.live());
    act(() => FakeRecognition.last.say("some words", true));
    await userEvent.click(screen.getByRole("button", { name: /Stop recording/ }));
    expect(screen.getByRole("button", { name: /Finishing/ })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(STOP_GRACE_MS + 50); });
    expect(screen.getByRole("button", { name: /Record more/ })).toBeInTheDocument();
    expect(answer()).toHaveValue("some words");
  });

  it("restarts quietly when Chrome ends a long recording by itself", async () => {
    render(<Harness />);
    await start();
    act(() => FakeRecognition.last.live());
    FakeRecognition.last.start.mockClear();
    act(() => FakeRecognition.last.onend?.());
    expect(FakeRecognition.last.start).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Listening… speak now/)).toBeInTheDocument();
  });

  it("stops by itself at the maximum length, says so, and keeps the words", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Harness />);
    await start();
    act(() => FakeRecognition.last.live());
    act(() => { FakeRecognition.last.say("some words", true); });
    act(() => { vi.advanceTimersByTime(10 * 60 * 1000 + 100); });
    expect(screen.getByText(/stopped automatically after 10 minutes/)).toBeInTheDocument();
    act(() => FakeRecognition.last.onend?.());
    expect(answer()).toHaveValue("some words");
  });
});

describe("when voice can't be used", () => {
  it("falls back to typing when the mic is denied", async () => {
    render(<Harness />);
    await start();
    act(() => FakeRecognition.last.onerror?.({ error: "not-allowed" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Microphone access was denied");
    expect(screen.queryByRole("button", { name: /recording/ })).toBeNull();
    await userEvent.type(answer(), "typed instead");
    expect(answer()).toHaveValue("typed instead");
  });

  it("offers typing when speech recognition is unsupported", async () => {
    delete (window as any).SpeechRecognition;
    render(<Harness />);
    await start();
    expect(screen.getByRole("alert")).toHaveTextContent("can't transcribe speech live");
    expect(screen.queryByRole("button", { name: /Start recording/ })).toBeNull();
  });

  it("allows 3 failed tries, then typing only", async () => {
    render(<Harness />);
    for (let i = 1; i <= 3; i++) {
      await start();
      act(() => FakeRecognition.last.onerror?.({ error: "service-not-allowed-ish" }));
      if (i < 3) expect(screen.getByRole("alert")).toHaveTextContent(`${i} of 3 tries used`);
    }
    expect(screen.queryByRole("button", { name: /recording/ })).toBeNull();
  });
});
