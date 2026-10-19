import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import VoiceAnswer from "@/components/VoiceAnswer";
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

function Harness() {
  const [value, setValue] = useState("");
  return <VoiceAnswer value={value} onChange={setValue} onSpokenSeconds={() => {}} />;
}

const stopTrack = vi.fn();
beforeEach(() => {
  FakeRecorder.instances = [];
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })) } });
  delete (window as any).SpeechRecognition;
  delete (window as any).webkitSpeechRecognition;
});
afterEach(() => vi.unstubAllGlobals());

async function openFallback() {
  render(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
  return screen.findByRole("button", { name: /Record audio/ });
}

describe("audio transcription fallback", () => {
  it("when live speech isn't supported, records audio, sends it to the server, and fills the answer", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ text: "I led the migration" }) }));
    vi.stubGlobal("fetch", fetchMock);
    await userEvent.click(await openFallback());
    await userEvent.click(await screen.findByRole("button", { name: /Stop and transcribe/ }));
    await waitFor(() => expect(screen.getByLabelText("Your answer")).toHaveValue("I led the migration"));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/transcribe");
    expect((init.body as FormData).get("file")).toBeInstanceOf(Blob);
    expect(stopTrack).toHaveBeenCalled(); // the microphone is released
  });

  it("shows the server's message when transcription fails, and typing still works", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: "Transcription is unavailable right now. Please type your answer instead." }) })));
    await userEvent.click(await openFallback());
    await userEvent.click(await screen.findByRole("button", { name: /Stop and transcribe/ }));
    expect(await screen.findByText(/Transcription is unavailable/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Your answer"), "typed");
    expect(screen.getByLabelText("Your answer")).toHaveValue("typed");
  });

  it("does not offer audio recording when the microphone itself is denied", async () => {
    class Rec { onerror: any; start() {} stop() {} abort() {} }
    let inst: Rec;
    (window as any).SpeechRecognition = class extends Rec { constructor() { super(); inst = this; } };
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    act(() => inst!.onerror({ error: "not-allowed" }));
    expect(screen.queryByRole("button", { name: /Record audio/ })).toBeNull();
    delete (window as any).SpeechRecognition;
  });

  it("does not offer it when the browser can't record audio either", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Start recording/ }));
    expect(screen.queryByRole("button", { name: /Record audio/ })).toBeNull();
    expect(screen.getByRole("alert")).toBeInTheDocument();
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
