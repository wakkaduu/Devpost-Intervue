"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { useAudioRecorder, MAX_AUDIO_RECORDING_MS } from "@/hooks/useAudioRecorder";
import { useSpeechRecognition, joinTranscript, MAX_RECORDING_MS } from "@/hooks/useSpeechRecognition";
import LiveDeliveryHUD from "@/components/LiveDeliveryHUD";
import { stopSpeaking } from "@/lib/speech-synthesis";
import { formatDuration } from "@/lib/session-logic";
import ErrorMessage from "@/components/ui/ErrorMessage";

interface Props {
  value: string;
  onChange: (text: string) => void;
  /** Total seconds spent recording for this answer, reported when a recording stops. */
  onSpokenSeconds: (seconds: number) => void;
  /** Called when recording starts or stops, so the interviewer's voice can pause while you speak. */
  onRecordingChange?: (recording: boolean) => void;
}

/** The answer box for voice mode: record to fill it with a live transcript, then edit it freely or just type. */
export default function VoiceAnswer({ value, onChange, onSpokenSeconds, onRecordingChange }: Props) {
  const speech = useSpeechRecognition();
  const recorder = useAudioRecorder((blob) => void transcribeBlob(blob));
  const [transcribing, setTranscribing] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const base = useRef("");

  // Anything the microphone is doing: starting up, listening, or finishing the last words.
  const speechActive = speech.isRecording || speech.isStopping;
  const engaged = speech.isRecording || speech.isStopping || recorder.isRecording || recorder.isStarting;
  // Only time spent with the microphone really live counts towards speaking time, not the start-up wait.
  const listening = speech.isListening || recorder.isRecording;

  // While recording (and until the last words arrive after Stop), the answer is what was there before plus the transcript so far.
  const wasActive = useRef(false);
  useEffect(() => {
    if (speechActive || wasActive.current) onChange(joinTranscript([base.current, speech.finalTranscript]));
    wasActive.current = speechActive;
  }, [speechActive, speech.finalTranscript]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => onRecordingChange?.(engaged), [engaged]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => setRecordedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [listening]);

  // Speaking time is reported as it grows, so answers submitted mid-recording still carry it.
  useEffect(() => {
    if (recordedSeconds > 0) onSpokenSeconds(recordedSeconds);
  }, [recordedSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    stopSpeaking(); // the interviewer stops talking when you start
    if (speech.isStopping) return; // the last words are still arriving
    if (speech.isRecording) {
      speech.stop();
    } else {
      base.current = value;
      speech.start();
    }
  }

  // When live speech recognition can't be used but the microphone may be fine (Firefox, a blocked speech
  // service), offer to record audio and have the server transcribe it.
  const canRecordAudio =
    speech.typingOnly && ["unsupported", "network", "failed"].includes(speech.unavailableReason ?? "") && recorder.isSupported;

  async function transcribeBlob(blob: Blob | null) {
    if (!blob) {
      setAudioError("Nothing was recorded. Try again, or type your answer.");
      return;
    }
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("file", blob, "answer");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transcription failed.");
      onChange(joinTranscript([base.current, data.text]));
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Transcription failed. Please type your answer instead.");
    } finally {
      setTranscribing(false);
    }
  }

  async function toggleAudio() {
    setAudioError(null);
    stopSpeaking();
    if (recorder.isStarting || transcribing) return;
    if (!recorder.isRecording) {
      base.current = value;
      void recorder.start();
      return;
    }
    await transcribeBlob(await recorder.stop());
  }

  const maxMinutes = MAX_RECORDING_MS / 60000;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="answer" className="text-sm font-semibold text-darkslate-700">Your answer</label>
        {canRecordAudio && (
          <Button
            variant={recorder.isRecording ? "danger" : "primary"}
            size="sm"
            loading={transcribing || recorder.isStarting}
            onClick={() => void toggleAudio()}
            aria-pressed={recorder.isRecording}
          >
            {transcribing
              ? "Transcribing…"
              : recorder.isStarting
                ? "Starting microphone…"
                : recorder.isRecording
                  ? `■ Stop and transcribe (${formatDuration(recordedSeconds)})`
                  : "● Record audio"}
          </Button>
        )}
        {!speech.typingOnly && (
          <Button
            variant={speech.isListening ? "danger" : "primary"}
            size="sm"
            loading={speech.isStopping}
            onClick={toggle}
            aria-pressed={speech.isListening}
            className={speech.isListening ? "animate-pulse-ring" : ""}
          >
            {speech.isStopping
              ? "Finishing…"
              : speech.isStarting
                ? "Starting microphone… (cancel)"
                : speech.isListening
                  ? `■ Stop recording (${formatDuration(recordedSeconds)})`
                  : value.trim()
                    ? "● Record more"
                    : "● Start recording"}
          </Button>
        )}
      </div>

      <textarea
        id="answer"
        value={value}
        readOnly={engaged || transcribing}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        className="mt-1 w-full rounded-xl border border-sage-400 bg-white p-3 text-darkslate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 read-only:bg-sage-50"
        placeholder={speech.typingOnly ? "Type your answer here…" : "Press “Start recording” and speak, or type here…"}
      />

      {speech.isListening && <LiveDeliveryHUD transcript={speech.finalTranscript} seconds={recordedSeconds} />}

      {speech.isStarting && (
        <p role="status" className="mt-2 text-sm font-semibold text-gold-800">
          Starting the microphone… wait for “Listening” before you speak. If your browser asks, choose Allow.
        </p>
      )}
      {speech.isListening && (
        <p role="status" className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-darkslate-600">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 animate-pulse-ring rounded-full bg-red-600" />
          <span className="font-semibold text-red-700">Listening… speak now</span>
          {speech.interimTranscript && <span className="italic text-darkslate-600">{speech.interimTranscript}</span>}
        </p>
      )}
      {speech.isStopping && (
        <p role="status" className="mt-2 text-sm font-semibold text-darkslate-700">Finishing your last words…</p>
      )}

      {recorder.isStarting && (
        <p role="status" className="mt-2 text-sm font-semibold text-gold-800">Starting the microphone… wait for “Recording” before you speak. If your browser asks, choose Allow.</p>
      )}
      {recorder.isRecording && (
        <p role="status" className="mt-2 flex items-center gap-2 text-sm">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 animate-pulse-ring rounded-full bg-red-600" />
          <span className="font-semibold text-red-700">Recording…</span> <span className="text-darkslate-600">Press stop and we’ll turn it into text.</span>
        </p>
      )}
      {recorder.autoStopped && (
        <p role="status" className="mt-2 text-sm font-semibold text-gold-800">Recording stopped automatically after {MAX_AUDIO_RECORDING_MS / 60000} minutes.</p>
      )}
      {(audioError || recorder.error) && (
        <ErrorMessage className="mt-2">{audioError ?? recorder.error}</ErrorMessage>
      )}

      {speech.autoStopped && (
        <p role="status" className="mt-2 text-sm font-semibold text-gold-800">
          Recording stopped automatically after {maxMinutes} minutes. Your answer is saved below.
        </p>
      )}

      {speech.error && (
        <ErrorMessage className="mt-2">
          {speech.error}
          {!speech.typingOnly && speech.retryCount > 0 && ` (${speech.retryCount} of 3 tries used)`}
        </ErrorMessage>
      )}
      {speech.typingOnly && !speech.error && (
        <p className="mt-2 text-sm text-darkslate-600">Voice isn’t available, so please type your answer.</p>
      )}
    </div>
  );
}
