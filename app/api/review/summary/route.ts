// POST /api/review/summary: server-side AI debrief across a whole session.
import { NextRequest, NextResponse } from "next/server";
import { validateDebriefRequest } from "@/lib/debrief";
import { requestDebrief } from "@/lib/debrief-evaluator";
import { GEMINI_MODEL } from "@/lib/gemini";

export const maxDuration = 30;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  let debriefRequest;
  try {
    debriefRequest = validateDebriefRequest(body);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request." }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[debrief] GEMINI_API_KEY is not set");
    return NextResponse.json({ error: "Review service is not configured." }, { status: 503 });
  }

  try {
    const debrief = await requestDebrief(debriefRequest, apiKey);
    console.log(`[debrief] answered by gemini (${GEMINI_MODEL})`);
    return NextResponse.json({ debrief: { ...debrief, source: "ai" } });
  } catch (err) {
    console.error("[debrief] gemini failed:", err);
    return NextResponse.json({ error: "The debrief is unavailable right now. Please try again." }, { status: 502 });
  }
}
