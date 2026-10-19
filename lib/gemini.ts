// Server-only Gemini client. Never import this from client components:
// it reads the secret key from the environment.
import { GoogleGenerativeAI, SchemaType, type ObjectSchema } from "@google/generative-ai";
import type { Feedback, ReviewRequest } from "@/types";
import { validateFeedback } from "@/lib/validation";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

const str = { type: SchemaType.STRING } as const;
const strList = { type: SchemaType.ARRAY, items: str } as const;

const FEEDBACK_SCHEMA: ObjectSchema = {
  type: SchemaType.OBJECT,
  properties: {
    score: { type: SchemaType.INTEGER, description: "Integer 1-10" },
    summary: str,
    strengths: strList,
    areasForImprovement: strList,
    focusNext: str,
    strongerVersion: str,
    followUpQuestion: str,
    howTheyAnswered: str,
    toneAnalysis: str,
    questionConnection: str,
  },
  required: [
    "score", "summary", "strengths", "areasForImprovement", "focusNext",
    "strongerVersion", "followUpQuestion", "howTheyAnswered", "toneAnalysis", "questionConnection",
  ],
};

/** Builds a prompt that asks for a review specific to this exact answer. */
export function buildPrompt(request: ReviewRequest): string {
  const prior = request.priorFocus?.length
    ? `\nYou have ALREADY told this candidate on earlier questions:\n${request.priorFocus.map((f) => `- ${f}`).join("\n")}\nDo not repeat those points. If this answer repeats the same mistake, say so in one short sentence and spend your effort on something NEW.\n`
    : "";

  return `You are an experienced interviewer running a mock interview for: ${request.category}.
You want this candidate to get the job, so you are honest, direct and specific. Speak to the candidate as "you", in plain spoken English.

Question you asked: ${request.question}
The candidate's answer${request.mode === "mic" ? " (spoken and auto-transcribed, so ignore punctuation and transcription glitches)" : " (typed)"}:
"""
${request.answer}
"""
${prior}
RULES
1. Everything must be specific to THIS answer. Quote or closely paraphrase at least two things the candidate actually said ("When you said '...', ..."). If a comment could be pasted onto a different answer, delete it.
2. Banned stock advice: "lacks depth", "be more specific", "add more detail", "use the STAR method", "quantify your impact". Say exactly WHAT is missing instead.
3. Never invent facts about the candidate. In the stronger version use only their facts, with [placeholders] where a fact is missing.
4. Pick the ONE change that would improve this answer most: that is "focusNext".

Scoring (integer 1-10): 1-3 fails to answer or is a sentence or two; 4-5 on topic but generic; 6-7 competent but missing a decision, trade-off, result or detail; 8-9 clear, concrete, owns their role, shows reasoning and a result; 10 exceptional.

Return JSON with exactly these fields:
score; summary (max 80 words, your honest spoken reaction, first person); strengths (1-3 strings that quote what worked); areasForImprovement (1-3 specific problems with the concrete fix); focusNext (1-2 sentences); strongerVersion (max 70 words, rewrite their weakest 1-3 sentences); followUpQuestion (the one question you would ask next to probe the weakest claim); howTheyAnswered (1-2 sentences on structure); toneAnalysis (1-2 sentences on how they came across, pointing at phrases); questionConnection (1-2 sentences: did they address what you asked).`;
}

/** Asks Gemini to review an answer. Throws on any failure. */
export async function requestGemini(request: ReviewRequest, apiKey: string): Promise<Feedback> {
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: GEMINI_MODEL });
  let lastError: unknown;
  // One retry: structured output occasionally breaks a constraint.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: buildPrompt(request) }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: FEEDBACK_SCHEMA, temperature: 0.4 },
      });
      return validateFeedback(JSON.parse(result.response.text()));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/** Runs any prompt through Gemini in JSON mode and returns the parsed value. Throws on failure. */
export async function requestGeminiJson(prompt: string, apiKey: string, schema: ObjectSchema): Promise<unknown> {
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.3 },
  });
  return JSON.parse(result.response.text());
}
