import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedSession } from "@/types";

// A tiny in-memory stand-in for the parts of the Supabase client that lib/db.ts uses.
type Row = Record<string, any>;
const tables: Record<string, Row[]> = {};
let uniqueEmails = true;

function builder(table: string) {
  const rows = () => (tables[table] ??= []);
  let filters: [string, unknown][] = [];
  let pending: { type: "insert" | "upsert"; row: Row; onConflict?: string } | null = null;
  let order: { col: string; asc: boolean } | null = null;
  let max = Infinity;

  const run = (): { data: any; error: any } => {
    if (pending) {
      const { type, row, onConflict } = pending;
      if (type === "insert") {
        if (table === "users" && uniqueEmails && rows().some((r) => r.email === row.email)) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        rows().push({ ...row });
      } else {
        const keys = onConflict!.split(",");
        const i = rows().findIndex((r) => keys.every((k) => r[k] === row[k]));
        if (i >= 0) rows()[i] = { ...row };
        else rows().push({ ...row });
      }
      return { data: { ...row }, error: null };
    }
    let out = rows().filter((r) => filters.every(([c, v]) => r[c] === v));
    if (order) out = [...out].sort((a, b) => (a[order!.col] < b[order!.col] ? -1 : 1) * (order!.asc ? 1 : -1));
    return { data: out.slice(0, max), error: null };
  };

  const b: any = {
    select: () => b,
    eq: (c: string, v: unknown) => (filters.push([c, v]), b),
    order: (col: string, o: { ascending: boolean }) => ((order = { col, asc: o.ascending }), b),
    limit: (n: number) => ((max = n), b),
    insert: (row: Row) => ((pending = { type: "insert", row }), b),
    upsert: (row: Row, o: { onConflict: string }) => ((pending = { type: "upsert", row, onConflict: o.onConflict }), b),
    maybeSingle: async () => {
      const r = run();
      return { data: r.data?.[0] ?? null, error: r.error };
    },
    single: async () => run(),
    then: (resolve: (v: unknown) => void) => resolve(run()),
  };
  return b;
}

vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ from: (t: string) => builder(t) }) }));

import { createUser, EmailTakenError, getUserSessions, saveUserSession, verifyUserCredentials } from "@/lib/db";

const session = (id: string, score: number, createdAt: string): SavedSession => ({
  id, category: "Behavioral", mode: "typed", averageScore: score, questionCount: 1,
  entries: [{ question: "q", answer: "a", durationSec: 3 }], createdAt,
});

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  uniqueEmails = true;
});

describe("accounts", () => {
  it("creates a user with a hashed password and a lowercased email", async () => {
    const u = await createUser({ name: "Sam", email: "Sam@Example.COM", password: "supersecret1" });
    expect(u.email).toBe("sam@example.com");
    const stored = tables.users[0];
    expect(stored.password_hash).toMatch(/^\$2[aby]\$/);
    expect(stored.password_hash).not.toContain("supersecret1");
  });

  it("refuses a second account with the same email, in any capitalisation", async () => {
    await createUser({ name: "Sam", email: "sam@example.com", password: "supersecret1" });
    await expect(createUser({ name: "Other", email: "SAM@example.com", password: "anotherpass1" })).rejects.toBeInstanceOf(EmailTakenError);
    expect(tables.users).toHaveLength(1);
  });

  it("treats a database unique violation (a race) as email taken", async () => {
    await createUser({ name: "Sam", email: "sam@example.com", password: "supersecret1" });
    const real = tables.users[0];
    tables.users = []; // the pre-check will see nothing...
    uniqueEmails = true;
    tables.users.push(real); // ...but then the insert hits the constraint
    const spy = vi.spyOn(tables.users, "some");
    spy.mockReturnValue(false);
    await expect(createUser({ name: "Sam", email: "sam@example.com", password: "supersecret1" })).rejects.toBeInstanceOf(EmailTakenError);
  });

  it("verifies the right password and rejects the wrong one or an unknown email", async () => {
    await createUser({ name: "Sam", email: "sam@example.com", password: "supersecret1" });
    expect(await verifyUserCredentials("SAM@example.com", "supersecret1")).toMatchObject({ name: "Sam", email: "sam@example.com" });
    expect(await verifyUserCredentials("sam@example.com", "wrongpass")).toBeNull();
    expect(await verifyUserCredentials("nobody@example.com", "supersecret1")).toBeNull();
  });

  it("never returns the password hash", async () => {
    await createUser({ name: "Sam", email: "sam@example.com", password: "supersecret1" });
    const u = await verifyUserCredentials("sam@example.com", "supersecret1");
    expect(JSON.stringify(u)).not.toContain("$2");
  });
});

describe("saved sessions", () => {
  const me = { id: "u1", email: "sam@example.com" };

  it("saves the same session twice as one row, keeping the latest data", async () => {
    await saveUserSession(me, session("s1", 5, "2026-03-01T10:00:00.000Z"));
    await saveUserSession(me, session("s1", 7, "2026-03-01T10:00:00.000Z"));
    expect(tables.interview_sessions).toHaveLength(1);
    expect(tables.interview_sessions[0].average_score).toBe(7);
  });

  it("keeps two users' sessions apart even if they reuse a session id", async () => {
    await saveUserSession(me, session("same", 5, "2026-03-01T10:00:00.000Z"));
    await saveUserSession({ id: "u2", email: "x@y.com" }, session("same", 9, "2026-03-02T10:00:00.000Z"));
    expect(tables.interview_sessions).toHaveLength(2);
    expect((await getUserSessions("u1"))[0].averageScore).toBe(5);
    expect((await getUserSessions("u2"))[0].averageScore).toBe(9);
  });

  it("returns only the user's sessions, oldest first, in the app's shape", async () => {
    await saveUserSession(me, session("b", 6, "2026-03-02T10:00:00.000Z"));
    await saveUserSession(me, session("a", 5, "2026-03-01T10:00:00.000Z"));
    await saveUserSession({ id: "u2", email: "x@y.com" }, session("c", 9, "2026-03-03T10:00:00.000Z"));
    const got = await getUserSessions("u1");
    expect(got.map((s) => s.id)).toEqual(["a", "b"]);
    expect(got[0]).toMatchObject({ category: "Behavioral", averageScore: 5, createdAt: "2026-03-01T10:00:00.000Z" });
  });
});
