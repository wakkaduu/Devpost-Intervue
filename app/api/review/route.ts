// POST /api/review: server-side AI review of one answer.
// GEMINI_API_KEY is read here on the server and is never sent to the browser.
import { NextRequest, NextResponse } from "next/server";
import { validateReviewRequest } from "@/lib/validation";
import { requestGemini, GEMINI_MODEL } from "@/lib/gemini";

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[review] GEMINI_API_KEY is not set");
    return NextResponse.json({ error: "Review service is not configured." }, { status: 503 });
  }

  try {
    const feedback = await requestGemini(reviewRequest, apiKey);
    console.log(`[review] answered by gemini (${GEMINI_MODEL})`);
    return NextResponse.json({ feedback: { ...feedback, source: "ai" } });
  } catch (err) {
    console.error("[review] gemini failed:", err);
    return NextResponse.json({ error: "Review service unavailable. Please try again." }, { status: 502 });
  }
}
