// POST /api/auth/resend-confirmation { email }: sends a new code, at most once a minute.
// Unknown or already-verified emails get the same answer as a real send.
import { NextRequest, NextResponse } from "next/server";
import { issueConfirmationCode } from "@/lib/confirm-email";
import { jsonError, rateLimit, readJson } from "@/lib/http";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimit(request, "resendConfirmation");
  if (limited) return limited;

  const parsed = await readJson(request, 10_000);
  if (!parsed.ok) return parsed.response;
  const body = (typeof parsed.body === "object" && parsed.body !== null ? parsed.body : {}) as Record<string, unknown>;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) return NextResponse.json({ error: "Enter your email.", code: "VALIDATION_FAILED" }, { status: 400 });

  try {
    const result = await issueConfirmationCode(email, true);
    if (result.status === "cooldown") {
      return NextResponse.json({ ok: true, sent: false, retryAfterSeconds: result.retryAfterSeconds });
    }
    if (result.status === "email-failed") {
      return NextResponse.json({ error: "We couldn't send the email right now. Please try again in a minute.", code: "EMAIL_FAILED" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, sent: true });
  } catch (err) {
    console.error("[resend-confirmation] failed:", err);
    return NextResponse.json({ error: "We couldn't send a new code right now. Please try again." }, { status: 500 });
  }
}
