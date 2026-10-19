// GET /api/auth/providers-available: which social sign-in buttons the login page should show.
import { NextResponse } from "next/server";
import { availableProviders } from "@/lib/oauth";

export function GET() {
  return NextResponse.json(availableProviders());
}
