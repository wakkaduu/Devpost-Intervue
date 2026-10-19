// Request/response contract and prompt for the end-of-session debrief.
import type { Debrief, DebriefRequest } from "@/types";

export const MAX_DEBRIEF_ENTRIES = 20; // a full session is 12 questions; room to grow
export const MIN_DEBRIEF_ENTRIES = 2;

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required.`);
  if (value.length > max) throw new Error(`${field} is too long.`);
  return value.trim();
}

export function validateDebriefRequest(body: unknown): DebriefRequest {
  if (typeof body !== "object" || body === null) throw new Error("Request body must be an object.");
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.entries)) throw new Error("entries is required.");
  if (b.entries.length < MIN_DEBRIEF_ENTRIES) throw new Error(`A debrief needs at least ${MIN_DEBRIEF_ENTRIES} reviewed answers.`);
  if (b.entries.length > MAX_DEBRIEF_ENTRIES) throw new Error("Too many entries.");
  return {
    category: text(b.category, "category", 300),
    entries: b.entries.map((raw, i) => {
      if (typeof raw !== "object" || raw === null) throw new Error(`entries[${i}] must be an object.`);
      const e = raw as Record<string, unknown>;
      const score = Number(e.score);
      if (!Number.isInteger(score) || score < 1 || score > 10) throw new Error(`entries[${i}].score must be 1-10.`);
      return {
        question: text(e.question, `entries[${i}].question`, 1000),
        answer: text(e.answer, `entries[${i}].answer`, 8000),
        score,
        summary: text(e.summary, `entries[${i}].summary`, 2000),
        focusNext: text(e.focusNext, `entries[${i}].focusNext`, 1000),
      };
    }),
  };
}

export function buildDebriefPrompt(request: DebriefRequest): string {
  const answers = request.entries
    .map(
      (e, i) =>
        `Answer ${i + 1} (score ${e.score}/10)\nQuestion: ${e.question}\nCandidate said: """${e.answer}"""\nYour earlier note: ${e.summary}\nYour earlier top fix: ${e.focusNext}`
    )
    .join("\n\n");

  return `You are an experienced interviewer who just finished a mock interview for: ${request.category}. You want this candidate to get the job. Speak to them as "you", honest and specific.

Here are all their answers with your earlier notes:

${answers}

Write a debrief of the WHOLE session. Do not just repeat the per-answer notes: look across answers.
Rules:
1. Patterns must be things that show up in two or more answers (for example: never says what the result was, always says "we", jumps to the solution without the problem). Quote or point at the actual wording where you can.
2. Name the best and weakest answers by their number and say why, referring to what was actually said.
3. "fixFirst" is the single habit to change before the next session, and how.
4. Never invent facts about the candidate. No stock advice like "use the STAR method" or "be more specific".

Return JSON with exactly: overview (2-3 sentences, your honest impression of the whole session); patterns (2-4 strings, each a pattern across answers); bestAnswer {number, why}; weakestAnswer {number, why}; fixFirst (1-2 sentences).`;
}

/** Checks the debrief the AI returned. `answerCount` bounds the answer numbers. */
export function validateDebrief(value: unknown, answerCount: number): Debrief {
  if (typeof value !== "object" || value === null) throw new Error("Debrief is not an object.");
  const v = value as Record<string, unknown>;
  const pick = (field: "bestAnswer" | "weakestAnswer") => {
    const o = v[field] as Record<string, unknown> | undefined;
    const number = Number(o?.number);
    if (!o || !Number.isInteger(number) || number < 1 || number > answerCount) {
      throw new Error(`Debrief ${field}.number must be 1-${answerCount}.`);
    }
    return { number, why: text(o.why, `${field}.why`, 2000) };
  };
  if (!Array.isArray(v.patterns) || v.patterns.length === 0 || !v.patterns.every((p) => typeof p === "string" && p.trim())) {
    throw new Error("Debrief patterns must be a non-empty list of strings.");
  }
  return {
    overview: text(v.overview, "overview", 2000),
    patterns: v.patterns.slice(0, 5).map((p: string) => p.trim()),
    bestAnswer: pick("bestAnswer"),
    weakestAnswer: pick("weakestAnswer"),
    fixFirst: text(v.fixFirst, "fixFirst", 2000),
  };
}
