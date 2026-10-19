"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { useSidebar } from "@/context/SidebarContext";
import { getTrackIcon, sessionLength, splitTrackName } from "@/lib/questions";
import { DEFAULT_MODE, loadMode, saveMode, type PracticeMode } from "@/lib/mode-storage";
import { buildInterviewUrl } from "@/lib/start-practice";
import ErrorMessage from "@/components/ui/ErrorMessage";

const MODES: { value: PracticeMode; label: string; icon: string }[] = [
  { value: "mic", label: "Voice", icon: "🎙️" },
  { value: "typed", label: "Written", icon: "⌨️" },
];

export default function StartCard() {
  const router = useRouter();
  const { selectedTrack, setPickerOpen } = useSidebar();
  const [mode, setMode] = useState<PracticeMode>(DEFAULT_MODE);
  const [error, setError] = useState<string | null>(null);

  // Read the remembered mode after mount so server and browser render the same first paint.
  useEffect(() => setMode(loadMode()), []);

  function chooseMode(next: PracticeMode) {
    setMode(next);
    saveMode(next);
  }

  function start() {
    const result = buildInterviewUrl(selectedTrack, mode);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(result.url);
  }

  const title = selectedTrack ? splitTrackName(selectedTrack).title : null;
  const length = selectedTrack ? sessionLength(selectedTrack) : null;

  return (
    <section aria-label="Start practicing" className="card animate-scale-in p-5 sm:p-7">
      <p className="eyebrow">Your track</p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <h2 key={selectedTrack} className="animate-fade-up text-2xl font-bold leading-tight">
          {selectedTrack ? <><span aria-hidden="true">{getTrackIcon(selectedTrack)} </span>{title}</> : "No track chosen"}
        </h2>
        <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>Change track</Button>
      </div>
      {length && (
        <p className="mt-1 text-sm text-darkslate-600">{length.questions} questions, about {length.minutes} minutes</p>
      )}

      <fieldset className="mt-5">
        <legend className="text-sm font-semibold text-darkslate-700">How do you want to answer?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={[
                "flex min-h-[56px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-bold transition duration-200",
                "focus-within:ring-2 focus-within:ring-forest-600 active:scale-[0.98]",
                mode === m.value
                  ? "border-forest-700 bg-forest-700 text-white shadow-card"
                  : "border-sage-400 bg-white text-forest-800 hover:-translate-y-0.5 hover:border-forest-600 hover:shadow-card",
              ].join(" ")}
            >
              <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => chooseMode(m.value)} className="sr-only" />
              <span aria-hidden="true" className="text-lg leading-none">{m.icon}</span>
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <ErrorMessage className="mt-4">{error}</ErrorMessage>
      )}

      <div className="mt-5">
        <Button size="lg" fullWidth onClick={start}>Start practicing</Button>
      </div>
    </section>
  );
}
