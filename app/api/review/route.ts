// POST /api/review: server-side review of one answer (Gemini, then Groq, then the basic grader).
// API keys are read here on the server and are never sent to the browser.
import { NextRequest, NextResponse } from "next/server";
import { validateReviewRequest } from "@/lib/validation";
import { evaluateAnswer } from "@/lib/evaluator";

export const maxDuration = 30;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  let reviewRequest;
  try {
    reviewRequest = validateReviewRequest(body);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request." }, { status: 400 });
  }

  try {
    return NextResponse.json({ feedback: await evaluateAnswer(reviewRequest) });
  } catch (err) {
    console.error("[review] unexpected failure:", err);
    return NextResponse.json({ error: "Review service unavailable. Please try again." }, { status: 500 });
  }
}
