// POST /api/review: server-side review of one answer (Gemini, then Groq, then the basic grader).
// API keys are read here on the server and are never sent to the browser.
import { NextRequest, NextResponse } from "next/server";
import { validateReviewRequest } from "@/lib/validation";
import { evaluateAnswer } from "@/lib/evaluator";
import { jsonError, rateLimit, readJson } from "@/lib/http";

export const maxDuration = 30;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimit(request, "review");
  if (limited) return limited;

  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;

  let reviewRequest;
  try {
    reviewRequest = validateReviewRequest(parsed.body);
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : "Invalid request.", "VALIDATION_FAILED");
  }

  try {
    return NextResponse.json({ feedback: await evaluateAnswer(reviewRequest) });
  } catch (err) {
    console.error("[review] unexpected failure:", err);
    return jsonError(500, "Review service unavailable. Please try again.");
  }
}
