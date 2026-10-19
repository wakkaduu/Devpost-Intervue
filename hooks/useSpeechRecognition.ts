"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_RECORDING_MS = 10 * 60 * 1000;
export const MAX_RETRIES = 3;

/** Errors that mean the microphone or service can't be used at all: go straight to typing. */
const FATAL_ERRORS: Record<string, { reason: "denied" | "no-mic" | "network"; message: string }> = {
  "not-allowed": { reason: "denied", message: "Microphone access was denied. Allow the microphone in your browser settings, or type your answer instead." },
  "audio-capture": { reason: "no-mic", message: "No microphone was found. Connect one, or type your answer instead." },
  network: { reason: "network", message: "The browser's speech service could not be reached. Please type your answer, or try Google Chrome." },
};

function getApi(): typeof SpeechRecognition | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition };
  return window.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function joinTranscript(parts: string[]): string {
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Chrome takes a moment to connect to its speech service after start() (and waits for you to click Allow the first
 * time). Until it reports that the microphone is live, the app is "starting", not "listening", so people don't
 * begin talking into a microphone that isn't on yet.
 */
export type SpeechPhase = "idle" | "starting" | "listening" | "stopping";

/** If the engine reports it started but never says audio is flowing, assume it is live after this long. */
export const READY_FALLBACK_MS = 1500;
/** If it never reports starting at all (for example the permission prompt is ignored), give up after this long. */
export const STARTUP_TIMEOUT_MS = 12_000;
/** After Stop, wait this long at most for the engine to deliver its last words and end. */
export const STOP_GRACE_MS = 3000;

export function useSpeechRecognition() {
  const [isSupported, setIsSupported] = useState(false);
  const [phase, setPhaseState] = useState<SpeechPhase>("idle");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [fatal, setFatal] = useState<null | "denied" | "no-mic" | "unsupported" | "network">(null);
  const [autoStopped, setAutoStopped] = useState(false);

  const recRef = useRef<SpeechRecognition | null>(null);
  const finalsRef = useRef<string[]>([]);
  const wantRunning = useRef(false);
  const retriesRef = useRef(0);
  const phaseRef = useRef<SpeechPhase>("idle");
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPhase = useCallback((p: SpeechPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  useEffect(() => setIsSupported(!!getApi()), []);

  const clearTimers = useCallback(() => {
    for (const t of [maxTimer, startTimer, stopTimer]) {
      if (t.current) clearTimeout(t.current);
      t.current = null;
    }
  }, []);

  /** Everything is finished: no more words are coming. */
  const finalize = useCallback(() => {
    clearTimers();
    wantRunning.current = false;
    setInterimTranscript("");
    setPhase("idle");
  }, [clearTimers, setPhase]);

  /** Stop at once (an error happened, or the person cancelled before it even started). */
  const halt = useCallback(() => {
    wantRunning.current = false;
    try {
      recRef.current?.abort();
    } catch {
      // already stopped
    }
    finalize();
  }, [finalize]);

  /** Ask the engine to finish. It still delivers the last words you spoke, so we wait for it to end. */
  const finish = useCallback(() => {
    if (phaseRef.current !== "listening") return;
    wantRunning.current = false;
    if (maxTimer.current) clearTimeout(maxTimer.current);
    maxTimer.current = null;
    setPhase("stopping");
    try {
      recRef.current?.stop();
    } catch {
      finalize();
      return;
    }
    stopTimer.current = setTimeout(finalize, STOP_GRACE_MS);
  }, [finalize, setPhase]);

  const markReady = useCallback(() => {
    if (phaseRef.current !== "starting") return;
    if (startTimer.current) clearTimeout(startTimer.current);
    startTimer.current = null;
    setPhase("listening");
    maxTimer.current = setTimeout(() => {
      setAutoStopped(true);
      finish();
    }, MAX_RECORDING_MS);
  }, [finish, setPhase]);

  const start = useCallback(() => {
    const Api = getApi();
    if (!Api) {
      setFatal("unsupported");
      setError("This browser can't transcribe speech live. Please type your answer, or try Google Chrome.");
      return;
    }
    if (phaseRef.current !== "idle") return;
    setError(null);
    setAutoStopped(false);
    finalsRef.current = [];
    setFinalTranscript("");

    const rec = new Api();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    // The microphone is really live once audio capture begins (or, in engines that don't say so, once words arrive).
    rec.onaudiostart = () => markReady();
    rec.onspeechstart = () => markReady();
    rec.onstart = () => {
      // Some engines never send "audio start": trust "started" after a short moment.
      if (startTimer.current) clearTimeout(startTimer.current);
      startTimer.current = setTimeout(markReady, READY_FALLBACK_MS);
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      markReady();
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalsRef.current.push(result[0].transcript);
        else interim = result[0].transcript;
      }
      setFinalTranscript(joinTranscript(finalsRef.current));
      setInterimTranscript(interim);
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Pauses to think are normal; they aren't failures.
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (FATAL_ERRORS[event.error]) {
        setFatal(FATAL_ERRORS[event.error].reason);
        setError(FATAL_ERRORS[event.error].message);
        halt();
        return;
      }
      retriesRef.current += 1;
      setRetryCount(retriesRef.current);
      setError("Speech recognition hit a problem. You can try again or type your answer.");
      halt();
    };

    rec.onend = () => {
      // Chrome ends continuous recognition on its own now and then; restart unless the person stopped it.
      if (wantRunning.current && phaseRef.current === "listening") {
        try {
          rec.start();
        } catch {
          halt();
        }
        return;
      }
      // After Stop, "end" means the last words have been delivered.
      if (phaseRef.current === "stopping") finalize();
    };

    recRef.current = rec;
    wantRunning.current = true;
    setPhase("starting");
    try {
      rec.start();
    } catch {
      setError("Couldn't start the microphone. Try again or type your answer.");
      wantRunning.current = false;
      setPhase("idle");
      return;
    }
    startTimer.current = setTimeout(() => {
      if (phaseRef.current !== "starting") return;
      setError("The microphone didn't start. Check that you allowed it, then try again, or type your answer.");
      halt();
    }, STARTUP_TIMEOUT_MS);
  }, [finalize, halt, markReady, setPhase]);

  /** Stops listening. If it hasn't started yet this cancels; otherwise it waits briefly for the last words. */
  const stop = useCallback(() => {
    if (phaseRef.current === "starting") halt();
    else finish();
  }, [finish, halt]);

  useEffect(() => () => {
    wantRunning.current = false;
    clearTimers();
    try {
      recRef.current?.abort();
    } catch {
      // ignore
    }
  }, [clearTimers]);

  return {
    isSupported,
    /** The microphone is engaged: starting up or listening. */
    isRecording: phase === "starting" || phase === "listening",
    /** Asked to start but not live yet: don't talk yet. */
    isStarting: phase === "starting",
    /** The microphone is live and capturing. */
    isListening: phase === "listening",
    /** Stop was pressed; waiting for the last words to arrive. */
    isStopping: phase === "stopping",
    finalTranscript,
    interimTranscript,
    error,
    retryCount,
    autoStopped,
    /** True when voice can't be used any more (denied, unsupported, or 3 failed tries): typing is the only option. */
    typingOnly: fatal !== null || retryCount >= MAX_RETRIES,
    /** Why live voice stopped being available: lets the UI offer audio transcription when the microphone itself is fine. */
    unavailableReason: fatal ?? (retryCount >= MAX_RETRIES ? ("failed" as const) : null),
    start,
    stop,
  };
}
