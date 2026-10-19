"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_RECORDING_MS = 10 * 60 * 1000;
export const MAX_RETRIES = 3;

/** Errors that mean the microphone or service can't be used at all: go straight to typing. */
const FATAL_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access was denied. Allow the microphone in your browser settings, or type your answer instead.",
  "audio-capture": "No microphone was found. Connect one, or type your answer instead.",
  network: "The browser's speech service could not be reached. Type your answer instead, or try Google Chrome.",
};

function getApi(): typeof SpeechRecognition | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition };
  return window.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function joinTranscript(parts: string[]): string {
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function useSpeechRecognition() {
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [fatal, setFatal] = useState(false);
  const [autoStopped, setAutoStopped] = useState(false);

  const recRef = useRef<SpeechRecognition | null>(null);
  const finalsRef = useRef<string[]>([]);
  const wantRunning = useRef(false);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setIsSupported(!!getApi()), []);

  const halt = useCallback(() => {
    wantRunning.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    try {
      recRef.current?.stop();
    } catch {
      // already stopped
    }
    setInterimTranscript("");
    setIsRecording(false);
  }, []);

  const start = useCallback(() => {
    const Api = getApi();
    if (!Api) {
      setFatal(true);
      setError("Speech recognition isn't supported in this browser. Type your answer instead, or try Google Chrome.");
      return;
    }
    setError(null);
    setAutoStopped(false);
    finalsRef.current = [];
    setFinalTranscript("");

    const rec = new Api();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
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
        setFatal(true);
        setError(FATAL_ERRORS[event.error]);
        halt();
        return;
      }
      retriesRef.current += 1;
      setRetryCount(retriesRef.current);
      setError("Speech recognition hit a problem. You can try again or type your answer.");
      halt();
    };

    // Chrome ends continuous recognition on its own after a while; restart unless the user stopped it.
    rec.onend = () => {
      if (!wantRunning.current) return;
      try {
        rec.start();
      } catch {
        halt();
      }
    };

    recRef.current = rec;
    wantRunning.current = true;
    try {
      rec.start();
    } catch {
      setError("Couldn't start the microphone. Try again or type your answer.");
      wantRunning.current = false;
      return;
    }
    setIsRecording(true);
    timerRef.current = setTimeout(() => {
      setAutoStopped(true);
      halt();
    }, MAX_RECORDING_MS);
  }, [halt]);

  const stop = useCallback(() => halt(), [halt]);

  useEffect(() => () => {
    wantRunning.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      recRef.current?.abort();
    } catch {
      // ignore
    }
  }, []);

  return {
    isSupported,
    isRecording,
    finalTranscript,
    interimTranscript,
    error,
    retryCount,
    autoStopped,
    /** True when voice can't be used any more (denied, unsupported, or 3 failed tries): typing is the only option. */
    typingOnly: fatal || retryCount >= MAX_RETRIES,
    start,
    stop,
  };
}
