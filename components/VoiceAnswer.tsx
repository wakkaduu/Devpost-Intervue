"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { useAudioRecorder, MAX_AUDIO_RECORDING_MS } from "@/hooks/useAudioRecorder";
import { useSpeechRecognition, joinTranscript, MAX_RECORDING_MS } from "@/hooks/useSpeechRecognition";
import AudioMeter from "@/components/AudioMeter";
import LiveDeliveryHUD from "@/components/LiveDeliveryHUD";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
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

/**
 * The answer box for voice mode. One button does the whole job: record, and when the browser can't caption live
 * (no speech service, or it can't be reached) the same press quietly records audio instead and turns it into text
 * when you stop. Nobody has to find a second button.
 */
export default function VoiceAnswer({ value, onChange, onSpokenSeconds, onRecordingChange }: Props) {
  const speech = useSpeechRecognition();
  const recorder = useAudioRecorder((blob) => void transcribeBlob(blob));
  const [transcribing, setTranscribing] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const base = useRef("");
  // Set when the person pressed Start and live captions were tried. If they then fail, audio recording takes over.
  const [triedLive, setTriedLive] = useState(false);

  // Live captions can fail for reasons that audio recording gets around (no speech service, service unreachable).
  // Denied or missing microphones can't be worked around, so those stay typing-only.
  // A live-captions failure of any kind other than a denied or missing microphone is worked around by recording audio,
  // including an unexpected one-off error, so nobody has to press Start a second time.
  const liveBroken = ["unsupported", "network", "failed"].includes(speech.unavailableReason ?? "") || speech.retryCount > 0;
  const audioFallback = liveBroken && recorder.isSupported;
  const audioMode = audioFallback || (!speech.isSupported && recorder.isSupported);
  const noVoice = speech.typingOnly && !audioFallback; // denied, no microphone, or nothing works at all

  // Between live captions failing and audio recording opening there is a short hand-over. It is computed while rendering
  // (not in an effect), so the button never flickers back to "Start recording" in between.
  const switching = triedLive && audioFallback && !recorder.isStarting && !recorder.isRecording && !transcribing;

  // Anything the microphone is doing: starting up, listening, or finishing the last words.
  const speechActive = speech.isRecording || speech.isStopping;
  const engaged = speechActive || recorder.isRecording || recorder.isStarting || switching;
  const starting = speech.isStarting || recorder.isStarting || switching;
  const finishing = speech.isStopping || transcribing;
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

  // The seamless part: live captions just failed after the person pressed Start, so carry on by recording audio.
  // Some browsers (Brave) open the microphone and only then report that the speech service is unreachable, so this
  // must still happen even if "Listening" flashed up first. A short pause lets the speech engine let go of the microphone.
  useEffect(() => {
    if (!switching) return;
    const id = setTimeout(() => {
      setTriedLive(false);
      void recorder.start();
    }, 200);
    return () => clearTimeout(id);
  }, [switching]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function press() {
    stopSpeaking(); // the interviewer stops talking when you start
    setAudioError(null);
    if (finishing || recorder.isStarting || switching) return; // still working on the last step
    if (speech.isStarting || speech.isListening) {
      setTriedLive(false); // the person ended it themselves, so a later failure isn't theirs to be rescued from
      return speech.stop(); // cancels if still starting, otherwise finishes
    }
    if (recorder.isRecording) return transcribeBlob(await recorder.stop());
    base.current = value;
    if (audioMode) {
      void recorder.start();
    } else {
      setTriedLive(true);
      speech.start();
    }
  }

  const maxMinutes = MAX_RECORDING_MS / 60000;
  const word = audioMode ? "Recording" : "Listening";
  const label = transcribing
    ? "Transcribing…"
    : speech.isStopping
      ? "Finishing…"
      : speech.isStarting
        ? "Starting microphone… (cancel)"
        : recorder.isStarting || switching
          ? "Starting microphone…"
          : listening
            ? `■ Stop recording (${formatDuration(recordedSeconds)})`
            : value.trim()
              ? "● Record more"
              : "● Start recording";

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="answer" className="text-sm font-semibold text-darkslate-700">Your answer</label>
        {!noVoice && (
          <Button
            variant={listening ? "danger" : "primary"}
            size="sm"
            loading={finishing || recorder.isStarting || switching}
            onClick={() => void press()}
            aria-pressed={listening}
            className={listening ? "animate-pulse-ring" : ""}
          >
            {label}
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
        placeholder={noVoice ? "Type your answer here…" : "Press “Start recording” and speak, or type here…"}
      />

      {speech.isListening && <LiveDeliveryHUD transcript={speech.finalTranscript} seconds={recordedSeconds} />}

      {starting && (
        <p role="status" className="mt-2 text-sm font-semibold text-gold-800">
          Starting the microphone… wait for “{word}” before you speak. If your browser asks, choose Allow.
        </p>
      )}
      {speech.isListening && (
        <p role="status" className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-darkslate-600">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 animate-pulse-ring rounded-full bg-red-600" />
          <span className="font-semibold text-red-700">Listening… speak now</span>
          {speech.interimTranscript && <span className="italic text-darkslate-600">{speech.interimTranscript}</span>}
        </p>
      )}
      {recorder.isRecording && (
        <p role="status" className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-darkslate-600">
          <AudioMeter level={recorder.level} />
          <span className="font-semibold text-red-700">Recording… speak now</span>
          <span>Press Stop when you’re done and we’ll turn it into text.</span>
        </p>
      )}
      {speech.isStopping && <p role="status" className="mt-2 text-sm font-semibold text-darkslate-700">Finishing your last words…</p>}
      {transcribing && <LoadingSpinner className="mt-2" label="Turning your recording into text…" />}

      {audioMode && !engaged && !transcribing && (
        <p className="mt-2 text-xs text-darkslate-600">
          This browser can’t show live captions, so your words will appear a moment after you press Stop.
        </p>
      )}

      {recorder.autoStopped && (
        <p role="status" className="mt-2 text-sm font-semibold text-gold-800">Recording stopped automatically after {MAX_AUDIO_RECORDING_MS / 60000} minutes.</p>
      )}
      {(audioError || recorder.error) && <ErrorMessage className="mt-2">{audioError ?? recorder.error}</ErrorMessage>}

      {speech.autoStopped && (
        <p role="status" className="mt-2 text-sm font-semibold text-gold-800">
          Recording stopped automatically after {maxMinutes} minutes. Your answer is saved below.
        </p>
      )}

      {/* When audio recording takes over there is nothing to complain about: the person just keeps going. */}
      {speech.error && !audioFallback && (
        <ErrorMessage className="mt-2">
          {speech.error}
          {!speech.typingOnly && speech.retryCount > 0 && ` (${speech.retryCount} of 3 tries used)`}
        </ErrorMessage>
      )}
      {noVoice && !speech.error && <p className="mt-2 text-sm text-darkslate-600">Voice isn’t available, so please type your answer.</p>}
    </div>
  );
}
