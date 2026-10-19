import type { DeliveryMetrics } from "@/lib/speech-metrics";

// Shared types

export interface Question {
  id: string;
  category: string;
  text: string;
}

export type AnswerMode = "mic" | "typed";

export interface Feedback {
  score: number; // 1-10
  summary: string;
  strengths: string[];
  areasForImprovement: string[];
  focusNext: string;
  strongerVersion: string;
  followUpQuestion: string;
  howTheyAnswered: string;
  toneAnalysis: string;
  questionConnection: string;
  /** "ai" for Gemini or Groq, "basic" for the built-in rule-based grader. */
  source?: "ai" | "basic";
  /** Which service actually wrote this review. */
  provider?: "gemini" | "groq" | "basic";
}

export interface ReviewRequest {
  question: string;
  answer: string;
  category: string;
  mode: AnswerMode;
  /** Focus points already given earlier in the session, so the AI does not repeat them. */
  priorFocus?: string[];
}

/** One answered question in a practice session. */
export interface SessionEntry {
  question: string;
  answer: string;
  durationSec: number;
  /** True when the answer was spoken (voice mode and the mic was used). */
  spoken?: boolean;
  /** Words per minute, fillers and pace; computed in the browser for spoken answers. */
  delivery?: DeliveryMetrics;
  /** loading: review in flight. done: feedback arrived. error: the review failed and can be retried. */
  status: "loading" | "done" | "error";
  feedback?: Feedback;
  error?: string;
}

/** One reviewed answer, as sent to the debrief. */
export interface DebriefEntry {
  question: string;
  answer: string;
  score: number;
  summary: string;
  focusNext: string;
}

export interface DebriefRequest {
  category: string;
  entries: DebriefEntry[];
}

export interface Debrief {
  overview: string;
  patterns: string[];
  /** 1-based position among the reviewed answers. */
  bestAnswer: { number: number; why: string };
  weakestAnswer: { number: number; why: string };
  fixFirst: string;
  source?: "ai";
}

/** A completed session as stored for History. */
export interface SavedSession {
  id: string;
  category: string;
  mode: "mic" | "typed";
  averageScore: number;
  questionCount: number;
  entries: { question: string; answer: string; durationSec: number; feedback?: Feedback }[];
  /** ISO 8601 UTC timestamp. */
  createdAt: string;
}
