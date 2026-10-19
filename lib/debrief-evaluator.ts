// Server-only: asks Gemini for the session debrief.
import { SchemaType, type ObjectSchema } from "@google/generative-ai";
import type { Debrief, DebriefRequest } from "@/types";
import { buildDebriefPrompt, validateDebrief } from "@/lib/debrief";
import { requestGeminiJson } from "@/lib/gemini";
import { requestGroqJson } from "@/lib/groq-llm";
import { withTimeout, PROVIDER_TIMEOUT_MS } from "@/lib/evaluator";

const str = { type: SchemaType.STRING } as const;
const pointer: ObjectSchema = {
  type: SchemaType.OBJECT,
  properties: { number: { type: SchemaType.INTEGER }, why: str },
  required: ["number", "why"],
};

const DEBRIEF_SCHEMA: ObjectSchema = {
  type: SchemaType.OBJECT,
  properties: {
    overview: str,
    patterns: { type: SchemaType.ARRAY, items: str },
    bestAnswer: pointer,
    weakestAnswer: pointer,
    fixFirst: str,
  },
  required: ["overview", "patterns", "bestAnswer", "weakestAnswer", "fixFirst"],
};

/** Writes the debrief with Gemini, falling back to Groq. There is no rule-based debrief: if both fail, the caller shows an error and a retry. */
export async function requestDebrief(request: DebriefRequest, apiKey?: string, env: Record<string, string | undefined> = process.env): Promise<Debrief & { provider: "gemini" | "groq" }> {
  const prompt = buildDebriefPrompt(request);
  const attempts: { name: "gemini" | "groq"; run: () => Promise<unknown> }[] = [];
  const geminiKey = apiKey ?? env.GEMINI_API_KEY;
  if (geminiKey) attempts.push({ name: "gemini", run: () => requestGeminiJson(prompt, geminiKey, DEBRIEF_SCHEMA) });
  if (env.GROQ_API_KEY) attempts.push({ name: "groq", run: () => requestGroqJson(prompt, env.GROQ_API_KEY!) });

  let lastError: unknown = new Error("No AI provider is configured.");
  for (const attempt of attempts) {
    for (let tries = 0; tries < 2; tries++) {
      try {
        const raw = await withTimeout(attempt.run(), PROVIDER_TIMEOUT_MS, attempt.name);
        return { ...validateDebrief(raw, request.entries.length), provider: attempt.name };
      } catch (err) {
        lastError = err;
      }
    }
    console.warn(`[debrief] ${attempt.name} failed, trying the next provider`);
  }
  throw lastError;
}
