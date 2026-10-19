// POST /api/auth/confirm-email { email, code }: checks the 6-digit code and verifies the account.
import { NextRequest, NextResponse } from "next/server";
import { confirmEmail } from "@/lib/confirm-email";
import { jsonError, rateLimit, readJson } from "@/lib/http";
import { isValidCodeFormat } from "@/lib/security/confirmation";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimit(request, "confirmEmail");
  if (limited) return limited;

  const parsed = await readJson(request, 10_000);
  if (!parsed.ok) return parsed.response;
  const body = (typeof parsed.body === "object" && parsed.body !== null ? parsed.body : {}) as Record<string, unknown>;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) return NextResponse.json({ error: "Enter your email.", code: "VALIDATION_FAILED" }, { status: 400 });
  if (!isValidCodeFormat(body?.code)) {
    return NextResponse.json({ error: "Enter the 6-digit code from your email.", code: "VALIDATION_FAILED" }, { status: 400 });
  }

  try {
    const result = await confirmEmail(email, body.code as string);
    switch (result.status) {
      case "verified":
        return NextResponse.json({ verified: true });
      case "invalid":
        return NextResponse.json(
          { error: "That code isn't right.", code: "INVALID_CODE", attemptsLeft: result.attemptsLeft },
          { status: 400 }
        );
      case "expired":
        return NextResponse.json({ error: "That code has expired. Request a new one.", code: "CODE_EXPIRED" }, { status: 400 });
      case "locked":
        return NextResponse.json({ error: "Too many wrong tries. Request a new code.", code: "TOO_MANY_ATTEMPTS" }, { status: 429 });
      case "busy":
        return NextResponse.json({ error: "Please try again.", code: "BUSY" }, { status: 409 });
    }
  } catch (err) {
    console.error("[confirm-email] failed:", err);
    return NextResponse.json({ error: "We couldn't check that code right now. Please try again." }, { status: 500 });
  }
}
