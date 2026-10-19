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
  /** How loud the microphone is right now, 0 to 1. Lets the screen show that the voice is being picked up. */
  const [level, setLevel] = useState(0);
  const meterRef = useRef<{ raf: number; ctx: AudioContext } | null>(null);
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
    if (meterRef.current) {
      cancelAnimationFrame(meterRef.current.raf);
      meterRef.current.ctx.close().catch(() => {});
      meterRef.current = null;
      setLevel(0);
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /** A tiny level meter. Failing to build it never affects recording. */
  const startMeter = useCallback((stream: MediaStream) => {
    const Ctx = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
    if (!Ctx) return;
    try {
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let last = 0;
      const state = { raf: 0, ctx };
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        const next = Math.min(1, peak / 64);
        if (Math.abs(next - last) > 0.05) {
          last = next;
          setLevel(next); // only when it visibly changes, to keep re-renders few
        }
        state.raf = requestAnimationFrame(tick);
      };
      state.raf = requestAnimationFrame(tick);
      meterRef.current = state;
    } catch {
      // no meter, still records
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setAutoStopped(false);
    setIsStarting(true); // shown at once: opening the microphone (and its permission prompt) takes a moment
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (first) {
        // Right after the browser's speech engine lets go of the microphone it can briefly still be "busy". Try once more.
        const name = (first as { name?: string })?.name;
        if (name !== "NotReadableError" && name !== "AbortError" && name !== "TrackStartError") throw first;
        await new Promise((r) => setTimeout(r, 500));
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      streamRef.current = stream;
      startMeter(stream);
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
  }, [release, startMeter]);

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

  return { isSupported, isRecording, isStarting, level, error, autoStopped, start, stop };
}
