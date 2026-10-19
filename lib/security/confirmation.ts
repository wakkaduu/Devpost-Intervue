// Email confirmation codes: generation, keyed hashing, and the rules around them.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * A 6-digit code has only a million possibilities, so a plain hash of it could be reversed instantly
 * if the database leaked. Keying the hash with the server secret (and the account) means a leaked
 * database alone isn't enough to recover any code.
 */
export function hashCode(code: string, userId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return createHmac("sha256", secret).update(`${userId}:${code}`).digest("hex");
}

export function codeMatches(candidate: string, userId: string, storedHash: string): boolean {
  const a = Buffer.from(hashCode(candidate, userId), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isValidCodeFormat(code: unknown): code is string {
  return typeof code === "string" && /^\d{6}$/.test(code);
}

/** The code was issued at (expiry - TTL), so the resend cooldown needs no extra column. */
export function secondsUntilResend(expires: Date, now: Date): number {
  const sentAt = expires.getTime() - CODE_TTL_MS;
  return Math.max(0, Math.ceil((sentAt + RESEND_COOLDOWN_MS - now.getTime()) / 1000));
}
