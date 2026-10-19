// Server-only data access for accounts and saved sessions.
import bcrypt from "bcryptjs";
import type { SavedSession } from "@/types";
import { getSupabase } from "@/lib/supabase";

const BCRYPT_ROUNDS = 10;
const MAX_SESSIONS_RETURNED = 500;

let cachedDummyHash: string | null = null;
function dummyHash(): string {
  cachedDummyHash ??= bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);
  return cachedDummyHash;
}

export class DatabaseError extends Error {}
export class EmailTakenError extends Error {}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

function db() {
  const client = getSupabase();
  if (!client) throw new DatabaseError("The database is not configured.");
  return client;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function getUserByEmail(email: string) {
  const { data, error } = await db().from("users").select("*").eq("email", normalizeEmail(email)).maybeSingle();
  if (error) throw new DatabaseError(error.message);
  return data as (UserRecord & { password_hash: string | null; email_verified: boolean }) | null;
}

export async function createUser(input: { name: string; email: string; password: string }): Promise<UserRecord> {
  const email = normalizeEmail(input.email);
  if (await getUserByEmail(email)) throw new EmailTakenError();
  const row = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email,
    password_hash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
  };
  const { data, error } = await db().from("users").insert(row).select("id, name, email, image").single();
  if (error) {
    // 23505 = unique violation: someone registered the same email between our check and the insert.
    if (error.code === "23505") throw new EmailTakenError();
    throw new DatabaseError(error.message);
  }
  return data as UserRecord;
}

/** Returns the user if the email and password match, otherwise null. */
export async function verifyUserCredentials(email: string, password: string): Promise<UserRecord | null> {
  const user = await getUserByEmail(email);
  // Compare against a dummy hash when the user doesn't exist, so response time doesn't reveal which emails are registered.
  const hash = user?.password_hash ?? dummyHash();
  const ok = await bcrypt.compare(password, hash);
  if (!user || !user.password_hash || !ok) return null;
  return { id: user.id, name: user.name, email: user.email, image: user.image };
}

/** Saves a session for a user. Idempotent: the same (user, session id) is stored once and updated in place. */
export async function saveUserSession(user: { id: string; email: string }, session: SavedSession): Promise<void> {
  const { error } = await db()
    .from("interview_sessions")
    .upsert(
      {
        id: session.id,
        user_id: user.id,
        user_email: user.email,
        category: session.category,
        mode: session.mode,
        average_score: session.averageScore,
        question_count: session.questionCount,
        entries: session.entries,
        created_at: session.createdAt,
      },
      { onConflict: "user_id,id" }
    );
  if (error) throw new DatabaseError(error.message);
}

export async function getUserSessions(userId: string): Promise<SavedSession[]> {
  const { data, error } = await db()
    .from("interview_sessions")
    .select("id, category, mode, average_score, question_count, entries, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_SESSIONS_RETURNED);
  if (error) throw new DatabaseError(error.message);
  return (data ?? [])
    .map((r) => ({
      id: r.id as string,
      category: r.category as string,
      mode: r.mode as "mic" | "typed",
      averageScore: Number(r.average_score),
      questionCount: r.question_count as number,
      entries: r.entries as SavedSession["entries"],
      createdAt: new Date(r.created_at as string).toISOString(),
    }))
    .reverse(); // oldest first, like the guest store
}

/**
 * Finds or creates the account for someone who signed in with Google or GitHub, matched by email.
 * The provider has verified the email, so an existing account with that email is linked. If that
 * account was never email-verified, any password on it is cleared: whoever registered it first
 * hasn't proven they own the address, but the person who just signed in with the provider has.
 */
export async function upsertOAuthUser(input: { email: string; name?: string | null; image?: string | null }): Promise<UserRecord> {
  const email = normalizeEmail(input.email);
  const existing = await getUserByEmail(email);
  if (existing) {
    if (!existing.email_verified) {
      const { error } = await db()
        .from("users")
        .update({ email_verified: true, password_hash: null, confirmation_code_hash: null, confirmation_code_expires: null })
        .eq("id", existing.id);
      if (error) throw new DatabaseError(error.message);
    }
    return { id: existing.id, name: existing.name, email: existing.email, image: existing.image };
  }
  const row = {
    id: crypto.randomUUID(),
    name: (input.name?.trim() || email.split("@")[0]).slice(0, 80),
    email,
    image: input.image ?? null,
    email_verified: true,
  };
  const { data, error } = await db().from("users").insert(row).select("id, name, email, image").single();
  if (error) {
    if (error.code === "23505") {
      // Lost a race with a parallel sign-in for the same email: use the account that won.
      const winner = await getUserByEmail(email);
      if (winner) return { id: winner.id, name: winner.name, email: winner.email, image: winner.image };
    }
    throw new DatabaseError(error.message);
  }
  return data as UserRecord;
}
