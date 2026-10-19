"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import ReviewCard from "@/components/ReviewCard";
import type { Feedback, Question } from "@/types";

export default function AnswerPractice({ question }: { question: Question }) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function submit() {
    if (!answer.trim()) {
      setError("Write an answer first, then ask for a review.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.text, answer, category: question.category, mode: "typed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setFeedback(data.feedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-sage-100 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-forest-600">{question.category}</p>
        <h2 className="mt-1 text-xl font-semibold text-darkslate-900">{question.text}</h2>

        <label htmlFor="answer" className="mt-4 block text-sm font-semibold text-darkslate-700">Your answer</label>
        <textarea
          id="answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={8}
          className="mt-1 w-full rounded-xl border border-sage-400 bg-white p-3 text-darkslate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          placeholder="Type your answer as you would say it in the interview…"
        />

        {error && (
          <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="mt-4">
          <Button onClick={submit} loading={loading} size="lg" fullWidth>
            {loading ? "Reviewing your answer…" : error && !feedback && answer.trim() ? "Try again" : "Get my review"}
          </Button>
        </div>
      </div>

      {feedback && <ReviewCard feedback={feedback} />}
    </div>
  );
}
