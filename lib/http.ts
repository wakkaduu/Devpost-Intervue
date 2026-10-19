// Shared helpers for API routes: consistent errors, rate limiting, and safe body reading.
import { NextRequest, NextResponse } from "next/server";
import { checkLimit, clientIp, type LimitName } from "@/lib/security/rate-limiter";
import { logSecurityEvent } from "@/lib/security/logger";

export const MAX_JSON_BYTES = 100_000;

export function jsonError(status: number, error: string, code?: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error, ...(code ? { code } : {}), ...extra }, { status });
}

/** Returns a 429 response if this caller has used up the named limit, otherwise null. Counts the request. */
export function rateLimit(request: NextRequest, name: LimitName): NextResponse | null {
  const ip = clientIp(request.headers);
  const result = checkLimit(name, ip);
  if (result.allowed) return null;
  logSecurityEvent("RATE_LIMITED", { limit: name, ip, path: request.nextUrl.pathname });
  const res = jsonError(429, `Too many requests. Please wait ${result.retryAfterSeconds} seconds and try again.`, "RATE_LIMITED", {
    retryAfterSeconds: result.retryAfterSeconds,
  });
  res.headers.set("Retry-After", String(result.retryAfterSeconds));
  return res;
}

export type BodyResult = { ok: true; body: unknown } | { ok: false; response: NextResponse };

/** Reads a JSON body with a size cap. Bad JSON is a 400 and an oversized body a 413; neither reaches the route's own logic. */
export async function readJson(request: NextRequest, maxBytes = MAX_JSON_BYTES): Promise<BodyResult> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) return { ok: false, response: jsonError(413, "That request is too large.", "TOO_LARGE") };
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: jsonError(400, "Request body could not be read.", "BAD_REQUEST") };
  }
  if (text.length > maxBytes) return { ok: false, response: jsonError(413, "That request is too large.", "TOO_LARGE") };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: jsonError(400, "Request body must be valid JSON.", "BAD_REQUEST") };
  }
}
