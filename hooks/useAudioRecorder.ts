"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_AUDIO_RECORDING_MS = 4 * 60 * 1000;
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** Records the microphone to an audio Blob. Used when the browser has no built-in speech recognition. */
/** `onAutoStop` receives the audio when the time limit ends the recording (a manual stop returns it from `stop()` instead). */
export function useAudioRecorder(onAutoStop?: (blob: Blob | null) => void) {
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoStopped, setAutoStopped] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  const onAutoStopRef = useRef(onAutoStop);
  onAutoStopRef.current = onAutoStop;

  useEffect(() => {
    setIsSupported(typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  const release = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setAutoStopped(false);
    setIsStarting(true); // shown at once: opening the microphone (and its permission prompt) takes a moment
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = chunksRef.current.length ? new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" }) : null;
        release();
        setIsRecording(false);
        if (resolveRef.current) resolveRef.current(blob);
        else onAutoStopRef.current?.(blob);
        resolveRef.current = null;
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setIsStarting(false);
      timerRef.current = setTimeout(() => {
        setAutoStopped(true);
        if (recorder.state !== "inactive") recorder.stop();
      }, MAX_AUDIO_RECORDING_MS);
    } catch (err) {
      release();
      setIsStarting(false);
      const name = (err as { name?: string })?.name;
      setError(
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "Microphone access was denied. Allow the microphone in your browser settings, or type your answer."
          : name === "NotFoundError"
            ? "No microphone was found. Connect one, or type your answer."
            : "Couldn't start the microphone. Type your answer instead."
      );
    }
  }, [release]);

  /** Stops recording and resolves with the audio, or null if nothing was captured. */
  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") return resolve(null);
      resolveRef.current = resolve;
      recorder.stop();
    });
  }, []);

  useEffect(() => () => {
    release();
    try {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    } catch {
      // ignore
    }
  }, [release]);

  return { isSupported, isRecording, isStarting, error, autoStopped, start, stop };
}
