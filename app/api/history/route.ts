// GET /api/history: the signed-in user's saved sessions. POST: save one or more (idempotent).
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserSessions, saveUserSession } from "@/lib/db";
import { validateHistoryPayload } from "@/lib/history-validation";
import { rateLimit } from "@/lib/http";

const MAX_BODY_BYTES = 1_000_000;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimit(request, "history");
  if (limited) return limited;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to see your history." }, { status: 401 });
  try {
    return NextResponse.json({ sessions: await getUserSessions(session.user.id) });
  } catch (err) {
    console.error("[history GET] failed:", err);
    return NextResponse.json({ error: "We couldn't load your history right now." }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimit(request, "history");
  if (limited) return limited;

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Sign in to save your history." }, { status: 401 });
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Request is too large." }, { status: 413 });

  let sessions;
  try {
    sessions = validateHistoryPayload(JSON.parse(text));
  } catch (err) {
    const message = err instanceof SyntaxError ? "Request body must be valid JSON." : err instanceof Error ? err.message : "Invalid session data.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const user = { id: session.user.id, email: session.user.email };
  try {
    for (const s of sessions) await saveUserSession(user, s);
    return NextResponse.json({ saved: sessions.length }, { status: 201 });
  } catch (err) {
    console.error("[history POST] failed:", err);
    return NextResponse.json({ error: "We couldn't save your session right now." }, { status: 500 });
  }
}
