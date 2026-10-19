"use client";

import MicCheck from "@/components/MicCheck";
import Button from "@/components/ui/Button";

/** Shown once before question one in Voice mode: how it works, plus an optional microphone check. */
export default function VoiceSetup({ questionCount, onBegin }: { questionCount: number; onBegin: () => void }) {
  return (
    <div className="space-y-4 rounded-2xl bg-sage-100 p-5 text-darkslate-900 sm:p-6">
      <div>
        <h2 className="text-xl font-bold">Before you start: voice answers</h2>
        <p className="mt-1 text-sm text-darkslate-600">{questionCount} questions. Each one is read aloud and shown on screen.</p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Read or listen to the question.</li>
        <li>Press <strong>Start recording</strong> and answer out loud. You’ll see your words appear as you speak.</li>
        <li>Press <strong>Stop</strong>, fix any words the transcript got wrong, then go to the next question.</li>
      </ol>
      <p className="text-sm text-darkslate-700">
        Tip: use Chrome for the best live transcript. If your browser can’t transcribe live, we’ll offer to record audio instead. You can always type.
      </p>
      <MicCheck />
      <Button size="lg" fullWidth onClick={onBegin}>Start the interview</Button>
    </div>
  );
}
