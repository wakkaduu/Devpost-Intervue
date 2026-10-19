"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { useSidebar } from "@/context/SidebarContext";
import { getTrackIcon, sessionLength, splitTrackName } from "@/lib/questions";
import { DEFAULT_MODE, loadMode, saveMode, type PracticeMode } from "@/lib/mode-storage";
import { buildInterviewUrl } from "@/lib/start-practice";

const MODES: { value: PracticeMode; label: string }[] = [
  { value: "mic", label: "Voice" },
  { value: "typed", label: "Written" },
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
    <section aria-label="Start practicing" className="rounded-2xl bg-sage-100 p-5 sm:p-6 text-darkslate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-forest-600">Your track</p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold">
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
                "flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl border text-sm font-bold",
                "focus-within:ring-2 focus-within:ring-forest-600",
                mode === m.value ? "border-forest-700 bg-forest-700 text-white" : "border-sage-400 bg-white text-forest-800 hover:border-forest-600",
              ].join(" ")}
            >
              <input
                type="radio"
                name="mode"
                value={m.value}
                checked={mode === m.value}
                onChange={() => chooseMode(m.value)}
                className="sr-only"
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-5">
        <Button size="lg" fullWidth onClick={start}>Start practicing</Button>
      </div>
    </section>
  );
}
