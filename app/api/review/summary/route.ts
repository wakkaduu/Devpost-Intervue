// POST /api/review/summary: server-side AI debrief across a whole session.
import { NextRequest, NextResponse } from "next/server";
import { validateDebriefRequest } from "@/lib/debrief";
import { requestDebrief } from "@/lib/debrief-evaluator";
import { jsonError, rateLimit, readJson } from "@/lib/http";

export const maxDuration = 30;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimit(request, "debrief");
  if (limited) return limited;

  const parsed = await readJson(request, 500_000); // up to 12 answers of 8,000 characters
  if (!parsed.ok) return parsed.response;

  let debriefRequest;
  try {
    debriefRequest = validateDebriefRequest(parsed.body);
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : "Invalid request.", "VALIDATION_FAILED");
  }

  try {
    const debrief = await requestDebrief(debriefRequest);
    console.log(`[debrief] answered by ${debrief.provider}`);
    return NextResponse.json({ debrief: { ...debrief, source: "ai" } });
  } catch (err) {
    console.error("[debrief] all providers failed:", err);
    return jsonError(502, "The debrief is unavailable right now. Please try again.");
  }
}
