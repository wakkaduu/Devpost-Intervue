// POST /api/auth/register: create an email/password account.
import { NextRequest, NextResponse } from "next/server";
import { validateRegistration } from "@/lib/auth-validation";
import { createUser, EmailTakenError } from "@/lib/db";
import { issueConfirmationCode } from "@/lib/confirm-email";
import { jsonError, rateLimit, readJson } from "@/lib/http";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimit(request, "register");
  if (limited) return limited;

  const parsed = await readJson(request, 10_000);
  if (!parsed.ok) return parsed.response;

  const result = validateRegistration(parsed.body);
  if (!result.ok) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", fields: result.errors }, { status: 400 });
  }

  try {
    const user = await createUser(result.value);
    // The account exists but can't sign in until the emailed code is entered. If the email fails to send, the form offers "resend".
    const issued = await issueConfirmationCode(user.email, false).catch((err) => {
      console.error("[register] issuing the confirmation code failed:", err);
      return { status: "email-failed" as const };
    });
    return NextResponse.json(
      { user: { id: user.id, name: user.name, email: user.email }, needsConfirmation: true, emailSent: issued.status === "sent" },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in.", fields: { email: "This email is already registered." } },
        { status: 409 }
      );
    }
    console.error("[register] failed:", err);
    return NextResponse.json({ error: "We couldn't create your account right now. Please try again." }, { status: 500 });
  }
}
