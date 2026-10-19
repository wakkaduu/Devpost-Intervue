// Request and response validation shared by the API routes.
import type { AnswerMode, Feedback, ReviewRequest } from "@/types";

export const MAX_ANSWER_CHARS = 8000;
const MAX_QUESTION_CHARS = 1000;

function str(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  if (value.length > max) throw new Error(`${field} is too long.`);
  return value.trim();
}

export function validateReviewRequest(body: unknown): ReviewRequest {
  if (typeof body !== "object" || body === null) throw new Error("Request body must be an object.");
  const b = body as Record<string, unknown>;
  const mode: AnswerMode = b.mode === "mic" ? "mic" : "typed";
  const priorFocus = Array.isArray(b.priorFocus)
    ? b.priorFocus.filter((f): f is string => typeof f === "string").slice(0, 10).map((f) => f.slice(0, 500))
    : undefined;
  return {
    question: str(b.question, "question", MAX_QUESTION_CHARS),
    answer: str(b.answer, "answer", MAX_ANSWER_CHARS),
    category: str(b.category, "category", 300),
    mode,
    priorFocus,
  };
}

function strList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === "string" && v.trim())) {
    throw new Error(`Review field "${field}" must be a non-empty list of strings.`);
  }
  return value.slice(0, 5).map((v: string) => v.trim());
}

/** Checks the shape of a review the AI returned. Throws if anything is missing or out of range. */
export function validateFeedback(value: unknown): Feedback {
  if (typeof value !== "object" || value === null) throw new Error("Review is not an object.");
  const v = value as Record<string, unknown>;
  const score = Number(v.score);
  if (!Number.isInteger(score) || score < 1 || score > 10) throw new Error("Review score must be an integer 1-10.");
  const text = (field: string): string => {
    const s = v[field];
    if (typeof s !== "string" || !s.trim()) throw new Error(`Review field "${field}" is missing.`);
    return s.trim();
  };
  return {
    score,
    summary: text("summary"),
    strengths: strList(v.strengths, "strengths"),
    areasForImprovement: strList(v.areasForImprovement, "areasForImprovement"),
    focusNext: text("focusNext"),
    strongerVersion: text("strongerVersion"),
    followUpQuestion: text("followUpQuestion"),
    howTheyAnswered: text("howTheyAnswered"),
    toneAnalysis: text("toneAnalysis"),
    questionConnection: text("questionConnection"),
  };
}
