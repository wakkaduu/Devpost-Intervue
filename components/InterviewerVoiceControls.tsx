"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import {
  SPEEDS, getInterviewerMuted, getInterviewerSpeed, isSpeechSynthesisSupported,
  setInterviewerMuted, setInterviewerSpeed, speak, stopSpeaking,
} from "@/lib/speech-synthesis";

/**
 * Lets the interviewer read the question aloud. Auto-read can be muted, but the Listen button always
 * works when the browser can speak, so hearing a question again is never more than one click away.
 */
export default function InterviewerVoiceControls({ text, paused }: { text: string; paused?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const ready = useRef(false);
  const speedRef = useRef(1);

  useEffect(() => {
    setSupported(isSpeechSynthesisSupported());
    setMuted(getInterviewerMuted());
    const s = getInterviewerSpeed();
    setSpeed(s);
    speedRef.current = s;
    ready.current = true;
  }, []);

  function say() {
    setHint(null);
    speak(text, speedRef.current, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: (blocked) => {
        setSpeaking(false);
        setHint(blocked ? "Your browser needs a click before it will read aloud. Press Listen." : "Couldn't read the question aloud.");
      },
    });
  }

  // Read each new question automatically, unless muted or the person is already recording.
  useEffect(() => {
    if (!ready.current || !supported || muted || paused) return;
    say();
    return () => {
      stopSpeaking();
      setSpeaking(false);
    };
  }, [text, supported]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop talking the moment recording starts, so the microphone doesn't hear the interviewer.
  useEffect(() => {
    if (paused) {
      stopSpeaking();
      setSpeaking(false);
    }
  }, [paused]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setInterviewerMuted(next);
    if (next) {
      stopSpeaking();
      setSpeaking(false);
    }
  }

  function changeSpeed(value: number) {
    setSpeed(value);
    speedRef.current = value;
    setInterviewerSpeed(value);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Interviewer voice">
      <Button
        size="sm"
        variant="secondary"
        disabled={!supported}
        onClick={speaking ? () => { stopSpeaking(); setSpeaking(false); } : say}
        aria-pressed={speaking}
      >
        {speaking ? "■ Stop" : "🔊 Listen"}
      </Button>
      <Button size="sm" variant="ghost" disabled={!supported} onClick={toggleMute} aria-pressed={muted}>
        {muted ? "Auto-read: off" : "Auto-read: on"}
      </Button>
      <label className="flex items-center gap-1 text-xs text-darkslate-600">
        Speed
        <select
          value={speed}
          disabled={!supported}
          onChange={(e) => changeSpeed(parseFloat(e.target.value))}
          className="min-h-[36px] rounded-lg border border-sage-400 bg-white px-2 text-sm text-darkslate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
        >
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </label>
      {!supported && <p className="w-full text-xs text-darkslate-600">Your browser can’t read aloud, so the question is shown as text only.</p>}
      {hint && <p role="status" className="w-full text-xs font-semibold text-gold-800">{hint}</p>}
    </div>
  );
}
