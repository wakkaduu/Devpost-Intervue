"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import ResumePrompt from "@/components/ResumePrompt";
import VoiceSetup from "@/components/VoiceSetup";
import VoiceAnswer from "@/components/VoiceAnswer";
import QuestionDisplay from "@/components/QuestionDisplay";
import { useSession } from "@/context/SessionContext";
import { formatDuration } from "@/lib/session-logic";
import type { PracticeMode } from "@/lib/mode-storage";
import { browserVoiceUsable } from "@/lib/speech-synthesis";
import { prefetchQuestionAudio } from "@/lib/server-voice";
import { clearDraft, loadDraft, saveDraft, type SessionDraft } from "@/lib/session-draft";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function InterviewSession({ category, mode }: { category: string; mode: PracticeMode }) {
  const router = useRouter();
  const { session, begin, submit, finish, hasActive, restore } = useSession();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [spokenSeconds, setSpokenSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const [begun, setBegun] = useState(false);

  // On arrival: carry on with a session already running in this tab; otherwise offer to resume a saved
  // draft from the last 24 hours; otherwise start fresh.
  const [gate, setGate] = useState<"checking" | "prompt" | "ready">("checking");
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const restoredCurrent = useRef<{ position: number; answer: string; elapsedSec: number; spokenSeconds: number } | null>(null);

  useEffect(() => {
    if (hasActive()) {
      begin(category, mode);
      setGate("ready");
      return;
    }
    const saved = loadDraft();
    if (saved) {
      setDraft(saved);
      setGate("prompt");
    } else {
      begin(category, mode);
      setGate("ready");
    }
  }, [begin, hasActive, category, mode]);

  // If this browser has no voice of its own, start fetching the first question's audio now (during the voice setup
  // screen or the first moments), so "Listen" doesn't make people wait for the server to speak it.
  const firstQuestion = session?.questions[0]?.text;
  const sessionId = session?.id;
  useEffect(() => {
    if (!firstQuestion) return;
    let cancelled = false;
    void browserVoiceUsable().then((usable) => {
      if (!cancelled && !usable) prefetchQuestionAudio(firstQuestion);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, firstQuestion]);

  function resumeDraft() {
    if (!draft) return;
    restoredCurrent.current = { position: draft.session.entries.length, ...draft.current };
    setBegun(true); // already past the voice setup screen
    restore(draft.session);
    setGate("ready");
    if (draft.session.category !== category) {
      // The saved session is for another track: show that track's page.
      const params = new URLSearchParams({ category: draft.session.category, mode: draft.session.mode });
      router.replace(`/interview?${params.toString()}`);
    }
  }

  function startNew() {
    clearDraft();
    begin(category, mode);
    setGate("ready");
  }

  const position = session ? session.entries.length : 0;
  // Voice mode starts with a short setup screen, shown once before the first question.
  const activeMode = session?.mode ?? mode; // a resumed session keeps the mode it was started in
  const needsSetup = activeMode === "mic" && !begun && position === 0;
  const started = !needsSetup;
  const question = session && !session.finished ? session.questions[position] : undefined;

  // A new question gets a fresh timer and an empty answer box.
  useEffect(() => {
    const restored = restoredCurrent.current;
    if (restored && restored.position === position) {
      // First render after resuming: bring back the half-written answer and the clock.
      restoredCurrent.current = null;
      setElapsed(restored.elapsedSec);
      setSpokenSeconds(restored.spokenSeconds);
      setAnswer(restored.answer);
    } else {
      setElapsed(0);
      setSpokenSeconds(0);
      setAnswer("");
    }
    setError(null);
  }, [position]);

  // Autosave shortly after anything changes. An empty session is never saved over a real draft (see saveDraft).
  const latest = useRef({ elapsed: 0, spokenSeconds: 0 });
  latest.current = { elapsed, spokenSeconds };
  useEffect(() => {
    if (!session || session.finished || gate !== "ready") return;
    const id = setTimeout(() => {
      saveDraft(session, { answer, elapsedSec: latest.current.elapsed, spokenSeconds: latest.current.spokenSeconds });
    }, 500);
    return () => clearTimeout(id);
  }, [session, answer, gate]);

  // Also save the moment the tab is hidden or closed, so the last few seconds of typing survive a refresh.
  useEffect(() => {
    const flush = () => {
      if (session && !session.finished && gate === "ready") {
        saveDraft(session, { answer, elapsedSec: latest.current.elapsed, spokenSeconds: latest.current.spokenSeconds });
      }
    };
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session, answer, gate]);

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
    else if (sawActive.current) {
      clearDraft(); // the session is complete, so there is nothing left to resume
      router.push("/summary");
    }
  }, [session, category, router]);

  if (gate === "prompt" && draft) {
    return (
      <div className="mx-auto max-w-2xl">
        <ResumePrompt draft={draft} requestedTrack={category} onResume={resumeDraft} onStartNew={startNew} />
      </div>
    );
  }

  if (!session || !question) {
    return <LoadingSpinner label="Loading your questions…" onCanvas />;
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

  const total = session.questions.length;

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
      <section aria-label="Question" className="card p-5 sm:p-7 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:col-span-5 lg:self-start">
        <div className="flex items-center gap-4 text-sm text-darkslate-600">
          <progress className="sr-only" max={total} value={position} aria-label="Session progress" />
          <div aria-hidden="true" className="flex flex-1 gap-1.5">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className="h-2 flex-1 overflow-hidden rounded-full bg-sage-300">
                <span className={`block h-full rounded-full bg-gradient-to-r from-forest-700 to-emerald-500 transition-all duration-500 ease-out ${i < position ? "w-full" : i === position ? "w-1/3" : "w-0"}`} />
              </span>
            ))}
          </div>
          <span aria-label="Time on this question" className="rounded-full bg-white/70 px-3 py-1 font-semibold tabular-nums text-darkslate-800 ring-1 ring-sage-300">{formatDuration(elapsed)}</span>
        </div>

        <div key={position} className="mt-6 animate-fade-up">
          <QuestionDisplay question={question} position={position + 1} total={total} paused={recording} upcoming={session.questions[position + 1]?.text} />
        </div>
      </section>

      <section aria-label="Answer workspace" className="card p-5 sm:p-7 lg:col-span-7">
        {activeMode === "mic" ? (
          <VoiceAnswer key={position} value={answer} onChange={changeAnswer} onSpokenSeconds={setSpokenSeconds} onRecordingChange={setRecording} />
        ) : (
          <div key={position} className="animate-fade-up">
            <label htmlFor="answer" className="block text-sm font-semibold text-darkslate-700">Your answer</label>
            <textarea
              id="answer"
              value={answer}
              onChange={(e) => changeAnswer(e.target.value)}
              rows={12}
              className="mt-2 w-full resize-y rounded-xl border border-sage-400 bg-white p-4 text-base leading-relaxed text-darkslate-900 shadow-inner transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
              placeholder="Type your answer as you would say it in the interview…"
            />
            <p className="mt-1 text-right text-xs tabular-nums text-darkslate-600">{answer.trim() ? answer.trim().split(/\s+/).length : 0} words</p>
          </div>
        )}

        {error && <ErrorMessage className="mt-3">{error}</ErrorMessage>}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <Button size="lg" onClick={next} className="sm:flex-1">{isLast ? "Finish and see results" : "Next question"}</Button>
          <Button size="lg" variant="secondary" onClick={endEarly}>End early</Button>
        </div>
        <p className="mt-3 text-xs text-darkslate-600">Each answer is reviewed in the background while you answer the next one.</p>
      </section>
    </div>
  );
}
