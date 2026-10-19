// Server-only: runs the provider chain for one review. Gemini first, then Groq, then the basic grader.
// Each AI provider gets its own time budget, so one slow service can't use up the other's turn.
import type { Feedback, ReviewRequest } from "@/types";
import { requestGemini } from "@/lib/gemini";
import { requestGroq } from "@/lib/groq-llm";
import { basicReview } from "@/lib/basic-grader";

export const PROVIDER_TIMEOUT_MS = 12_000;

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export interface Provider {
  name: "gemini" | "groq";
  run: () => Promise<Feedback>;
}

export function configuredProviders(request: ReviewRequest, env: Record<string, string | undefined> = process.env): Provider[] {
  const providers: Provider[] = [];
  if (env.GEMINI_API_KEY) providers.push({ name: "gemini", run: () => requestGemini(request, env.GEMINI_API_KEY!) });
  if (env.GROQ_API_KEY) providers.push({ name: "groq", run: () => requestGroq(request, env.GROQ_API_KEY!) });
  return providers;
}

export async function evaluateAnswer(
  request: ReviewRequest,
  providers: Provider[] = configuredProviders(request),
  timeoutMs = PROVIDER_TIMEOUT_MS
): Promise<Feedback> {
  for (const provider of providers) {
    try {
      const feedback = await withTimeout(provider.run(), timeoutMs, provider.name);
      console.log(`[review] answered by ${provider.name}`);
      return { ...feedback, source: "ai", provider: provider.name };
    } catch (err) {
      console.warn(`[review] ${provider.name} failed, trying the next provider:`, err instanceof Error ? err.message : err);
    }
  }
  console.warn("[review] all AI providers failed or none configured; using the basic grader");
  return { ...basicReview(request), source: "basic", provider: "basic" };
}
