// Server-only: the second AI provider. A Groq-hosted open model, used when Gemini fails.
import type { Feedback, ReviewRequest } from "@/types";
import { validateFeedback } from "@/lib/validation";
import { buildPrompt } from "@/lib/gemini";

export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Runs a prompt through the Groq chat model in JSON mode and returns the parsed value. Throws on any failure. */
export async function requestGroqJson(prompt: string, apiKey: string, temperature = 0.3): Promise<unknown> {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Groq returned HTTP ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned an empty response");
  return JSON.parse(content);
}

/** Reviews an answer with Groq. One retry, because models sometimes break a field rule. */
export async function requestGroq(request: ReviewRequest, apiKey: string): Promise<Feedback> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return validateFeedback(await requestGroqJson(buildPrompt(request), apiKey, 0.4));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
