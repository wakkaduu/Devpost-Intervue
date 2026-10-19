"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { SPEEDS, getInterviewerMuted, getInterviewerSpeed, setInterviewerMuted, setInterviewerSpeed } from "@/lib/speech-synthesis";
import { speakQuestion, stopAllSpeech } from "@/lib/interviewer-voice";
import { prefetchQuestionAudio } from "@/lib/server-voice";

/**
 * Lets the interviewer read the question aloud, with the browser's voice or, when the browser has none, the
 * server's. Auto-read can be muted, but the Listen button always works, so hearing a question again is
 * never more than one click away. `upcoming` is the next question, fetched ahead of time when the server's voice is in use.
 */
export default function InterviewerVoiceControls({ text, paused, upcoming }: { text: string; paused?: boolean; upcoming?: string }) {
  const [ready_, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usingServer, setUsingServer] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const ready = useRef(false);
  const speedRef = useRef(1);

  useEffect(() => {
    setReady(true);
    setMuted(getInterviewerMuted());
    const s = getInterviewerSpeed();
    setSpeed(s);
    speedRef.current = s;
    ready.current = true;
  }, []);

  function say() {
    setHint(null);
    void speakQuestion(text, speedRef.current, {
      onSource: (src) => setUsingServer(src === "server"),
      onLoading: setLoading,
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: (blocked) => {
        setSpeaking(false);
        setLoading(false);
        setHint(blocked ? "Your browser needs a click before it will read aloud. Press Listen." : "Couldn’t read the question aloud. You can still read it on screen.");
      },
    });
  }

  // Read each new question automatically, unless muted or the person is already recording.
  useEffect(() => {
    if (!ready.current || !ready_ || muted || paused) return;
    say();
    return () => {
      stopAllSpeech();
      setSpeaking(false);
      setLoading(false);
    };
  }, [text, ready_]); // eslint-disable-line react-hooks/exhaustive-deps

  // With the server's voice the first request takes a few seconds, so fetch the next question while this one is being answered.
  useEffect(() => {
    if (usingServer && upcoming) prefetchQuestionAudio(upcoming);
  }, [usingServer, upcoming]);

  // Stop talking the moment recording starts, so the microphone doesn't hear the interviewer.
  useEffect(() => {
    if (paused) {
      stopAllSpeech();
      setSpeaking(false);
      setLoading(false);
    }
  }, [paused]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setInterviewerMuted(next);
    if (next) {
      stopAllSpeech();
      setSpeaking(false);
      setLoading(false);
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
        onClick={speaking || loading ? () => { stopAllSpeech(); setSpeaking(false); setLoading(false); } : say}
        aria-pressed={speaking}
      >
        {loading && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />}
        {loading ? "Preparing voice…" : speaking ? "■ Stop" : "🔊 Listen"}
      </Button>
      <Button size="sm" variant="ghost" onClick={toggleMute} aria-pressed={muted}>
        {muted ? "Auto-read: off" : "Auto-read: on"}
      </Button>
      <label className="flex items-center gap-1 text-xs text-darkslate-600">
        Speed
        <select
          value={speed}
          onChange={(e) => changeSpeed(parseFloat(e.target.value))}
          className="min-h-[36px] rounded-lg border border-sage-400 bg-white px-2 text-sm text-darkslate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
        >
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </label>
      {hint && <p role="status" className="w-full text-xs font-semibold text-gold-800">{hint}</p>}
    </div>
  );
}
