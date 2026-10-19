import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import VoiceAnswer from "@/components/VoiceAnswer";

class FakeRecognition {
  static last: FakeRecognition;
  continuous = false; interimResults = false; lang = "";
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(); stop = vi.fn(); abort = vi.fn();
  constructor() { FakeRecognition.last = this; }
  say(text: string, isFinal = true) {
    this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })] });
  }
}

function Harness({ onSeconds = () => {} }: { onSeconds?: (n: number) => void }) {
  const [value, setValue] = useState("");
  return <VoiceAnswer value={value} onChange={setValue} onSpokenSeconds={onSeconds} />;
}

beforeEach(() => { (window as any).SpeechRecognition = FakeRecognition; });
afterEach(() => { delete (window as any).SpeechRecognition; vi.useRealTimers(); });

describe("VoiceAnswer", () => {
  it("shows a live transcript, then finalizes it as the answer on stop", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    act(() => FakeRecognition.last.say("I led the migration", true));
    act(() => FakeRecognition.last.say("and then we", false));
    expect(screen.getByText("and then we")).toBeInTheDocument(); // interim text
    expect(screen.getByLabelText("Your answer")).toHaveValue("I led the migration");
    await userEvent.click(screen.getByRole("button", { name: /Stop recording/ }));
    expect(FakeRecognition.last.stop).toHaveBeenCalled();
    expect(screen.getByLabelText("Your answer")).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText("Your answer")).toHaveValue("I led the migration");
  });

  it("falls back to typing when the mic is denied", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    act(() => FakeRecognition.last.onerror?.({ error: "not-allowed" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Microphone access was denied");
    expect(screen.queryByRole("button", { name: /recording/ })).toBeNull();
    await userEvent.type(screen.getByLabelText("Your answer"), "typed instead");
    expect(screen.getByLabelText("Your answer")).toHaveValue("typed instead");
  });

  it("offers typing when speech recognition is unsupported", async () => {
    delete (window as any).SpeechRecognition;
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("isn't supported");
    expect(screen.queryByRole("button", { name: /recording/ })).toBeNull();
  });

  it("allows 3 failed tries, then typing only", async () => {
    render(<Harness />);
    for (let i = 1; i <= 3; i++) {
      await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
      act(() => FakeRecognition.last.onerror?.({ error: "service-not-allowed-ish" }));
      if (i < 3) expect(screen.getByRole("alert")).toHaveTextContent(`${i} of 3 tries used`);
    }
    expect(screen.queryByRole("button", { name: /recording/ })).toBeNull();
  });

  it("stops by itself at the maximum length and says so", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    act(() => { FakeRecognition.last.say("some words", true); });
    act(() => { vi.advanceTimersByTime(10 * 60 * 1000 + 100); });
    expect(screen.getByText(/stopped automatically after 10 minutes/)).toBeInTheDocument();
    expect(screen.getByLabelText("Your answer")).toHaveValue("some words");
  });

  it("reports speaking seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const seconds = vi.fn();
    render(<Harness onSeconds={seconds} />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    act(() => { vi.advanceTimersByTime(3100); });
    expect(seconds).toHaveBeenLastCalledWith(3);
  });
});
