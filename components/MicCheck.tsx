"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";

type CheckState = "idle" | "testing" | "ok" | "denied" | "missing" | "error";

const HEARD_AFTER_FRAMES = 8;
const LOUD_ENOUGH = 0.12;

/** A quick optional microphone test with a live level meter, so recording problems show up before question one. */
export default function MicCheck() {
  const [state, setState] = useState<CheckState>("idle");
  const [level, setLevel] = useState(0);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    ctx.current?.close().catch(() => {});
    ctx.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  async function start() {
    stop();
    setLevel(0);
    setState("testing");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audio = new Ctx();
      ctx.current = audio;
      const analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      audio.createMediaStreamSource(media).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let loudFrames = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let peak = 0;
        for (const v of samples) peak = Math.max(peak, Math.abs(v - 128));
        const normalized = Math.min(1, peak / 64);
        setLevel(normalized);
        if (normalized > LOUD_ENOUGH) loudFrames += 1;
        if (loudFrames > HEARD_AFTER_FRAMES) setState("ok");
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      stop();
      const name = (err as { name?: string })?.name;
      setState(name === "NotAllowedError" || name === "PermissionDeniedError" ? "denied" : name === "NotFoundError" ? "missing" : "error");
    }
  }

  const message: Record<CheckState, string> = {
    idle: "Press the button, then say a few words such as “testing, one, two, three”.",
    testing: "Listening… say a few words.",
    ok: "We can hear you. Your microphone works.",
    denied: "Microphone access was denied. Allow it in your browser’s site settings, or choose Written answers.",
    missing: "No microphone was found. Connect one, or choose Written answers.",
    error: "We couldn’t start the microphone. You can still try recording, or choose Written answers.",
  };
  const failed = state === "denied" || state === "missing" || state === "error";

  return (
    <div className="rounded-xl border border-sage-300 bg-white/70 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-forest-700">Microphone check (optional)</h3>
      <p role={failed ? "alert" : "status"} className={`mt-1 text-sm ${failed ? "text-red-700" : state === "ok" ? "font-semibold text-forest-700" : "text-darkslate-700"}`}>
        {message[state]}
      </p>
      <div
        role="meter"
        aria-label="Microphone level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        className="mt-3 h-3 overflow-hidden rounded-full bg-sage-300"
      >
        <div className="h-full bg-forest-700 transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
      </div>
      <div className="mt-3">
        {state === "testing" || state === "ok" ? (
          <Button size="sm" variant="secondary" onClick={() => { stop(); setLevel(0); setState("idle"); }}>Stop test</Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => void start()}>{failed ? "Try again" : "Test my microphone"}</Button>
        )}
      </div>
    </div>
  );
}
