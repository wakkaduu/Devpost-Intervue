"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { useSpeechRecognition, joinTranscript, MAX_RECORDING_MS } from "@/hooks/useSpeechRecognition";
import { formatDuration } from "@/lib/session-logic";

interface Props {
  value: string;
  onChange: (text: string) => void;
  /** Total seconds spent recording for this answer, reported when a recording stops. */
  onSpokenSeconds: (seconds: number) => void;
}

/** The answer box for voice mode: record to fill it with a live transcript, then edit it freely or just type. */
export default function VoiceAnswer({ value, onChange, onSpokenSeconds }: Props) {
  const speech = useSpeechRecognition();
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const base = useRef("");

  // While recording, the answer is whatever was there before plus what has been transcribed so far.
  useEffect(() => {
    if (speech.isRecording) onChange(joinTranscript([base.current, speech.finalTranscript]));
  }, [speech.isRecording, speech.finalTranscript]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!speech.isRecording) return;
    const id = setInterval(() => setRecordedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [speech.isRecording]);

  // Speaking time is reported as it grows, so answers submitted mid-recording still carry it.
  useEffect(() => {
    if (recordedSeconds > 0) onSpokenSeconds(recordedSeconds);
  }, [recordedSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  // A final result can land just after stop; make sure the last words are kept.
  const wasRecording = useRef(false);
  useEffect(() => {
    if (wasRecording.current && !speech.isRecording && speech.finalTranscript) {
      onChange(joinTranscript([base.current, speech.finalTranscript]));
    }
    wasRecording.current = speech.isRecording;
  }, [speech.isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    if (speech.isRecording) {
      speech.stop();
    } else {
      base.current = value;
      speech.start();
    }
  }

  const maxMinutes = MAX_RECORDING_MS / 60000;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="answer" className="text-sm font-semibold text-darkslate-700">Your answer</label>
        {!speech.typingOnly && (
          <Button
            variant={speech.isRecording ? "danger" : "primary"}
            size="sm"
            onClick={toggle}
            aria-pressed={speech.isRecording}
          >
            {speech.isRecording ? `■ Stop recording (${formatDuration(recordedSeconds)})` : value.trim() ? "● Record more" : "● Start recording"}
          </Button>
        )}
      </div>

      <textarea
        id="answer"
        value={value}
        readOnly={speech.isRecording}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        className="mt-1 w-full rounded-xl border border-sage-400 bg-white p-3 text-darkslate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 read-only:bg-sage-50"
        placeholder={speech.typingOnly ? "Type your answer here…" : "Press “Start recording” and speak, or type here…"}
      />

      {speech.isRecording && (
        <p role="status" className="mt-2 text-sm text-darkslate-600">
          <span className="font-semibold text-red-700">Listening…</span>{" "}
          {speech.interimTranscript && <span className="italic text-darkslate-500">{speech.interimTranscript}</span>}
        </p>
      )}

      {speech.autoStopped && (
        <p role="status" className="mt-2 text-sm font-semibold text-gold-800">
          Recording stopped automatically after {maxMinutes} minutes. Your answer is saved below.
        </p>
      )}

      {speech.error && (
        <div role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {speech.error}
          {!speech.typingOnly && speech.retryCount > 0 && ` (${speech.retryCount} of 3 tries used)`}
        </div>
      )}
      {speech.typingOnly && !speech.error && (
        <p className="mt-2 text-sm text-darkslate-600">Voice isn’t available, so please type your answer.</p>
      )}
    </div>
  );
}
