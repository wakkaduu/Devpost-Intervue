import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmEmail, issueConfirmationCode, type ConfirmDeps } from "@/lib/confirm-email";
import {
  CODE_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS, codeMatches, generateCode, hashCode, isValidCodeFormat, secondsUntilResend,
} from "@/lib/security/confirmation";
import type { ConfirmationState } from "@/lib/db";

describe("confirmation helpers", () => {
  it("generates 6-digit numeric codes, including ones with leading zeros", () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
    expect(isValidCodeFormat("012345")).toBe(true);
    for (const bad of ["12345", "1234567", "12345a", "", null, 123456]) expect(isValidCodeFormat(bad)).toBe(false);
  });

  it("hashes are keyed by account and by the server secret", () => {
    const h = hashCode("123456", "user-1");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode("123456", "user-2")).not.toBe(h);
    expect(codeMatches("123456", "user-1", h)).toBe(true);
    expect(codeMatches("123457", "user-1", h)).toBe(false);
    expect(codeMatches("123456", "user-2", h)).toBe(false);
    const old = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "a-different-secret";
    expect(hashCode("123456", "user-1")).not.toBe(h);
    process.env.AUTH_SECRET = old;
  });

  it("works out the resend cooldown from the expiry", () => {
    const sentAt = new Date("2026-03-01T10:00:00Z");
    const expires = new Date(sentAt.getTime() + CODE_TTL_MS);
    expect(secondsUntilResend(expires, new Date(sentAt.getTime() + 10_000))).toBe(50);
    expect(secondsUntilResend(expires, new Date(sentAt.getTime() + RESEND_COOLDOWN_MS))).toBe(0);
    expect(secondsUntilResend(expires, new Date(sentAt.getTime() + 5 * 60_000))).toBe(0);
  });
});

// In-memory deps for the flow.
function setup() {
  let clock = new Date("2026-03-01T10:00:00Z");
  const user: ConfirmationState = { id: "u1", name: "Sam", email: "sam@example.com", emailVerified: false, codeHash: null, codeExpires: null, attempts: 0 };
  const sent: { to: string; code: string }[] = [];
  const state = { sendOk: true, casFails: false };
  const deps: ConfirmDeps = {
    getState: vi.fn(async (email: string) => (email.toLowerCase() === user.email ? { ...user } : null)),
    setCode: vi.fn(async (_id: string, hash: string, expires: Date) => { user.codeHash = hash; user.codeExpires = expires; user.attempts = 0; }),
    recordAttempt: vi.fn(async (_id: string, current: number) => {
      if (state.casFails || user.attempts !== current) return false;
      user.attempts += 1;
      return true;
    }),
    markVerified: vi.fn(async () => { user.emailVerified = true; user.codeHash = null; user.codeExpires = null; }),
    sendEmail: vi.fn(async (m: { to: string; code: string }) => { sent.push(m); return state.sendOk ? { ok: true } : { ok: false, error: "x" }; }),
    now: () => clock,
  } as unknown as ConfirmDeps;
  return { user, sent, deps, state, advance: (ms: number) => (clock = new Date(clock.getTime() + ms)) };
}

describe("issueConfirmationCode", () => {
  it("emails a code and stores only its keyed hash, expiring in 15 minutes", async () => {
    const t = setup();
    expect(await issueConfirmationCode("sam@example.com", false, t.deps)).toEqual({ status: "sent" });
    const code = t.sent[0].code;
    expect(code).toMatch(/^\d{6}$/);
    expect(t.user.codeHash).not.toContain(code);
    expect(codeMatches(code, "u1", t.user.codeHash!)).toBe(true);
    expect(t.user.codeExpires!.getTime() - new Date("2026-03-01T10:00:00Z").getTime()).toBe(CODE_TTL_MS);
  });

  it("enforces the 60-second resend cooldown, then allows a resend with a new code", async () => {
    const t = setup();
    await issueConfirmationCode("sam@example.com", false, t.deps);
    t.advance(20_000);
    expect(await issueConfirmationCode("sam@example.com", true, t.deps)).toEqual({ status: "cooldown", retryAfterSeconds: 40 });
    expect(t.sent).toHaveLength(1);
    t.advance(41_000);
    expect(await issueConfirmationCode("sam@example.com", true, t.deps)).toEqual({ status: "sent" });
    expect(t.sent).toHaveLength(2);
  });

  it("does not apply the cooldown right after sign-up", async () => {
    const t = setup();
    await issueConfirmationCode("sam@example.com", false, t.deps);
    expect(await issueConfirmationCode("sam@example.com", false, t.deps)).toEqual({ status: "sent" });
  });

  it("does nothing, identically, for unknown or already-verified emails", async () => {
    const t = setup();
    expect(await issueConfirmationCode("nobody@example.com", true, t.deps)).toEqual({ status: "nothing-to-do" });
    t.user.emailVerified = true;
    expect(await issueConfirmationCode("sam@example.com", true, t.deps)).toEqual({ status: "nothing-to-do" });
    expect(t.sent).toHaveLength(0);
  });

  it("reports an email failure", async () => {
    const t = setup();
    t.state.sendOk = false;
    expect(await issueConfirmationCode("sam@example.com", false, t.deps)).toEqual({ status: "email-failed" });
  });

  it("a resend resets the attempt counter and invalidates the old code", async () => {
    const t = setup();
    await issueConfirmationCode("sam@example.com", false, t.deps);
    const oldCode = t.sent[0].code;
    await confirmEmail("sam@example.com", "000000" === oldCode ? "111111" : "000000", t.deps);
    expect(t.user.attempts).toBe(1);
    t.advance(61_000);
    await issueConfirmationCode("sam@example.com", true, t.deps);
    expect(t.user.attempts).toBe(0);
    if (t.sent[1].code !== oldCode) expect((await confirmEmail("sam@example.com", oldCode, t.deps)).status).toBe("invalid");
  });
});

describe("confirmEmail", () => {
  let t: ReturnType<typeof setup>;
  let code: string;
  beforeEach(async () => {
    t = setup();
    await issueConfirmationCode("sam@example.com", false, t.deps);
    code = t.sent[0].code;
  });
  const wrong = () => (code === "999999" ? "000000" : "999999");

  it("verifies the right code and clears it", async () => {
    expect(await confirmEmail("sam@example.com", code, t.deps)).toEqual({ status: "verified" });
    expect(t.user).toMatchObject({ emailVerified: true, codeHash: null });
  });

  it("is case-insensitive about the email", async () => {
    expect((await confirmEmail("SAM@Example.com", code, t.deps)).status).toBe("verified");
  });

  it("counts down attempts on wrong codes", async () => {
    expect(await confirmEmail("sam@example.com", wrong(), t.deps)).toEqual({ status: "invalid", attemptsLeft: MAX_ATTEMPTS - 1 });
    expect(await confirmEmail("sam@example.com", wrong(), t.deps)).toEqual({ status: "invalid", attemptsLeft: MAX_ATTEMPTS - 2 });
  });

  it("locks after 5 wrong tries, even for the right code", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) await confirmEmail("sam@example.com", wrong(), t.deps);
    expect(await confirmEmail("sam@example.com", code, t.deps)).toEqual({ status: "locked" });
    expect(t.user.emailVerified).toBe(false);
  });

  it("a new code unlocks it", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) await confirmEmail("sam@example.com", wrong(), t.deps);
    t.advance(61_000);
    await issueConfirmationCode("sam@example.com", true, t.deps);
    expect((await confirmEmail("sam@example.com", t.sent[1].code, t.deps)).status).toBe("verified");
  });

  it("rejects an expired code, even the right one", async () => {
    t.advance(CODE_TTL_MS + 1000);
    expect(await confirmEmail("sam@example.com", code, t.deps)).toEqual({ status: "expired" });
    expect(t.user.emailVerified).toBe(false);
  });

  it("accepts the right code right up to expiry", async () => {
    t.advance(CODE_TTL_MS - 1000);
    expect((await confirmEmail("sam@example.com", code, t.deps)).status).toBe("verified");
  });

  it("asks to retry when a parallel guess won the attempt counter, without checking the code", async () => {
    t.state.casFails = true;
    expect(await confirmEmail("sam@example.com", code, t.deps)).toEqual({ status: "busy" });
    expect(t.user.emailVerified).toBe(false);
  });

  it("treats an unknown email like a wrong code, and a missing code as expired", async () => {
    expect(await confirmEmail("nobody@example.com", "123456", t.deps)).toEqual({ status: "invalid", attemptsLeft: 0 });
    t.user.codeHash = null;
    expect((await confirmEmail("sam@example.com", "123456", t.deps)).status).toBe("expired");
  });

  it("an already-verified account is simply verified", async () => {
    t.user.emailVerified = true;
    expect((await confirmEmail("sam@example.com", "000000", t.deps)).status).toBe("verified");
  });
});
