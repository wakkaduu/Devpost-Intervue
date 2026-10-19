// POST /api/speak { text }: the interviewer's voice as audio, for browsers that cannot speak by themselves.
// It only reads questions from our own question bank, so it can't be used as a free text-to-speech service.
import { NextRequest, NextResponse } from "next/server";
import { jsonError, rateLimit, readJson } from "@/lib/http";
import { isKnownQuestion } from "@/lib/questions";
import { synthesizeSpeech } from "@/lib/tts";

export const maxDuration = 45;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimit(request, "speak");
  if (limited) return limited;

  const parsed = await readJson(request, 5_000);
  if (!parsed.ok) return parsed.response;
  const text = (parsed.body as { text?: unknown } | null)?.text;
  if (!isKnownQuestion(text)) return jsonError(400, "Only interview questions can be read aloud.", "VALIDATION_FAILED");

  try {
    const wav = await synthesizeSpeech(text);
    return new NextResponse(new Uint8Array(wav), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(wav.length),
        // The same question always sounds the same, so the browser may keep it.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[speak] failed:", err instanceof Error ? err.message : err);
    return jsonError(502, "The voice is unavailable right now.");
  }
}
