"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import VoiceSetup from "@/components/VoiceSetup";
import VoiceAnswer from "@/components/VoiceAnswer";
import QuestionDisplay from "@/components/QuestionDisplay";
import { useSession } from "@/context/SessionContext";
import { formatDuration } from "@/lib/session-logic";
import type { PracticeMode } from "@/lib/mode-storage";

export default function InterviewSession({ category, mode }: { category: string; mode: PracticeMode }) {
  const router = useRouter();
  const { session, begin, submit, finish } = useSession();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [spokenSeconds, setSpokenSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const [begun, setBegun] = useState(false);

  useEffect(() => begin(category, mode), [begin, category, mode]);

  const position = session ? session.entries.length : 0;
  // Voice mode starts with a short setup screen, shown once before the first question.
  const needsSetup = mode === "mic" && !begun && position === 0;
  const started = !needsSetup;
  const question = session && !session.finished ? session.questions[position] : undefined;

  // A new question gets a fresh timer and an empty answer box.
  useEffect(() => {
    setElapsed(0);
    setSpokenSeconds(0);
    setAnswer("");
    setError(null);
  }, [position]);

  useEffect(() => {
    if (!question || !started) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [question, started]);

  // A session that finishes while this page is open (last answer, or ended early) goes to Results.
  // A finished session left over from before is not redirected: begin() replaces it with a new one.
  const sawActive = useRef(false);
  useEffect(() => {
    if (!session || session.category !== category) return;
    if (!session.finished) sawActive.current = true;
    else if (sawActive.current) router.push("/summary");
  }, [session, category, router]);

  if (!session || !question) {
    return <p className="text-forest-100" role="status">Loading your questions…</p>;
  }

  if (needsSetup) return <VoiceSetup questionCount={session.questions.length} onBegin={() => setBegun(true)} />;

  const isLast = position === session.questions.length - 1;

  function changeAnswer(text: string) {
    setAnswer(text);
    if (error) setError(null);
  }

  function next() {
    if (!submit(answer, elapsed, spokenSeconds)) setError("Write an answer before you continue.");
  }

  function endEarly() {
    finish(answer.trim() ? { answer, durationSec: elapsed, spokenSeconds } : undefined);
  }

  return (
    <div className="rounded-2xl bg-sage-100 p-5 sm:p-6 text-darkslate-900">
      <div className="flex items-center justify-between text-sm text-darkslate-600">
        <progress className="sr-only" max={session.questions.length} value={position} aria-label="Session progress" />
        <div aria-hidden="true" className="mr-4 h-2 flex-1 overflow-hidden rounded-full bg-sage-300">
          <div className="h-full bg-forest-700" style={{ width: `${(position / session.questions.length) * 100}%` }} />
        </div>
        <span aria-label="Time on this question" className="tabular-nums font-semibold">{formatDuration(elapsed)}</span>
      </div>

      <div className="mt-4">
        <QuestionDisplay question={question} position={position + 1} total={session.questions.length} paused={recording} />
      </div>

      {mode === "mic" ? (
        <VoiceAnswer key={position} value={answer} onChange={changeAnswer} onSpokenSeconds={setSpokenSeconds} onRecordingChange={setRecording} />
      ) : (
        <>
          <label htmlFor="answer" className="mt-4 block text-sm font-semibold text-darkslate-700">Your answer</label>
          <textarea
            id="answer"
            value={answer}
            onChange={(e) => changeAnswer(e.target.value)}
            rows={8}
            className="mt-1 w-full rounded-xl border border-sage-400 bg-white p-3 text-darkslate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
            placeholder="Type your answer as you would say it in the interview…"
          />
        </>
      )}

      {error && (
        <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
        <Button size="lg" onClick={next} className="sm:flex-1">{isLast ? "Finish and see results" : "Next question"}</Button>
        <Button size="lg" variant="secondary" onClick={endEarly}>End early</Button>
      </div>
      <p className="mt-3 text-xs text-darkslate-600">
        Each answer is reviewed in the background while you answer the next one.
      </p>
    </div>
  );
}
