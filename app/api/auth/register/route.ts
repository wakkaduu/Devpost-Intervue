// POST /api/auth/register: create an email/password account.
import { NextRequest, NextResponse } from "next/server";
import { validateRegistration } from "@/lib/auth-validation";
import { createUser, EmailTakenError } from "@/lib/db";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const result = validateRegistration(body);
  if (!result.ok) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", fields: result.errors }, { status: 400 });
  }

  try {
    const user = await createUser(result.value);
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } }, { status: 201 });
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
