// The email-confirmation flow: issue a code, resend it, check a guess.
// Database and email access are passed in so the rules can be tested on their own.
import {
  getConfirmationState, markEmailVerified, recordConfirmationAttempt, setConfirmationCode,
} from "@/lib/db";
import { sendConfirmationEmail } from "@/lib/email";
import {
  CODE_TTL_MS, MAX_ATTEMPTS, codeMatches, generateCode, hashCode, secondsUntilResend,
} from "@/lib/security/confirmation";

export interface ConfirmDeps {
  getState: typeof getConfirmationState;
  setCode: typeof setConfirmationCode;
  recordAttempt: typeof recordConfirmationAttempt;
  markVerified: typeof markEmailVerified;
  sendEmail: typeof sendConfirmationEmail;
  now: () => Date;
}

export const defaultDeps: ConfirmDeps = {
  getState: getConfirmationState,
  setCode: setConfirmationCode,
  recordAttempt: recordConfirmationAttempt,
  markVerified: markEmailVerified,
  sendEmail: sendConfirmationEmail,
  now: () => new Date(),
};

export type IssueResult =
  | { status: "sent" }
  | { status: "email-failed" }
  | { status: "cooldown"; retryAfterSeconds: number }
  /** Unknown address or already verified. Callers answer these the same as "sent", so the endpoint can't be used to find out who has an account. */
  | { status: "nothing-to-do" };

/** Creates and emails a fresh code. `enforceCooldown` is off right after sign-up. */
export async function issueConfirmationCode(email: string, enforceCooldown: boolean, deps: ConfirmDeps = defaultDeps): Promise<IssueResult> {
  const state = await deps.getState(email);
  if (!state || state.emailVerified) return { status: "nothing-to-do" };

  const now = deps.now();
  if (enforceCooldown && state.codeExpires) {
    const wait = secondsUntilResend(state.codeExpires, now);
    if (wait > 0) return { status: "cooldown", retryAfterSeconds: wait };
  }

  const code = generateCode();
  await deps.setCode(state.id, hashCode(code, state.id), new Date(now.getTime() + CODE_TTL_MS));
  const sent = await deps.sendEmail({ to: state.email, name: state.name, code });
  return sent.ok ? { status: "sent" } : { status: "email-failed" };
}

export type ConfirmResult =
  | { status: "verified" }
  | { status: "invalid"; attemptsLeft: number }
  | { status: "expired" }
  | { status: "locked" }
  | { status: "busy" };

/** Checks a guess. Unknown addresses look exactly like a wrong code. */
export async function confirmEmail(email: string, code: string, deps: ConfirmDeps = defaultDeps): Promise<ConfirmResult> {
  const state = await deps.getState(email);
  if (!state) return { status: "invalid", attemptsLeft: 0 };
  if (state.emailVerified) return { status: "verified" };
  if (!state.codeHash || !state.codeExpires) return { status: "expired" };
  if (state.codeExpires.getTime() <= deps.now().getTime()) return { status: "expired" };
  if (state.attempts >= MAX_ATTEMPTS) return { status: "locked" };

  // Count the guess before checking it, so every guess is limited even if requests arrive in parallel.
  if (!(await deps.recordAttempt(state.id, state.attempts))) return { status: "busy" };

  if (codeMatches(code, state.id, state.codeHash)) {
    await deps.markVerified(state.id);
    return { status: "verified" };
  }
  return { status: "invalid", attemptsLeft: Math.max(0, MAX_ATTEMPTS - (state.attempts + 1)) };
}
