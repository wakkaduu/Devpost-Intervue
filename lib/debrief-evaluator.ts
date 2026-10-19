// Server-only: asks Gemini for the session debrief.
import { SchemaType, type ObjectSchema } from "@google/generative-ai";
import type { Debrief, DebriefRequest } from "@/types";
import { buildDebriefPrompt, validateDebrief } from "@/lib/debrief";
import { requestGeminiJson } from "@/lib/gemini";

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

export async function requestDebrief(request: DebriefRequest, apiKey: string): Promise<Debrief> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await requestGeminiJson(buildDebriefPrompt(request), apiKey, DEBRIEF_SCHEMA);
      return validateDebrief(raw, request.entries.length);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
