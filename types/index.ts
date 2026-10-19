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
  /** Which grader produced this review. */
  source?: "ai" | "basic";
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
  /** loading: review in flight. done: feedback arrived. error: the review failed and can be retried. */
  status: "loading" | "done" | "error";
  feedback?: Feedback;
  error?: string;
}
