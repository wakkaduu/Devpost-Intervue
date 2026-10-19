import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createUser: vi.fn(),
  saveUserSession: vi.fn(),
  getUserSessions: vi.fn(),
  issue: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock("@/lib/confirm-email", () => ({ issueConfirmationCode: mocks.issue, confirmEmail: mocks.confirm }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({
  createUser: mocks.createUser,
  saveUserSession: mocks.saveUserSession,
  getUserSessions: mocks.getUserSessions,
  EmailTakenError: class EmailTakenError extends Error {},
}));

import { NextRequest } from "next/server";
import { limiter } from "@/lib/security/rate-limiter";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as historyGet, POST as historyPost } from "@/app/api/history/route";
import { EmailTakenError } from "@/lib/db";
import { POST as confirmRoute } from "@/app/api/auth/confirm-email/route";
import { POST as resendRoute } from "@/app/api/auth/resend-confirmation/route";

const req = (body: unknown, raw = false) =>
  new NextRequest("http://localhost/api/x", { method: "POST", body: raw ? (body as string) : JSON.stringify(body) });

const session = {
  id: "s1", category: "Behavioral", mode: "typed", averageScore: 7, questionCount: 1,
  entries: [{ question: "q", answer: "a", durationSec: 5 }], createdAt: "2026-03-01T10:00:00Z",
};

beforeEach(() => {
  limiter.clear();
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/auth/register", () => {
  it("creates an account (201), sends a confirmation code, and returns no password data", async () => {
    mocks.createUser.mockResolvedValue({ id: "u1", name: "Sam", email: "sam@example.com", image: null });
    mocks.issue.mockResolvedValue({ status: "sent" });
    const res = await register(req({ name: "Sam", email: "sam@example.com", password: "supersecret1" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ needsConfirmation: true, emailSent: true });
    expect(JSON.stringify(body)).not.toMatch(/password|hash|\b\d{6}\b/i);
    expect(mocks.issue).toHaveBeenCalledWith("sam@example.com", false);
  });

  it("still creates the account when the email fails, and says so", async () => {
    mocks.createUser.mockResolvedValue({ id: "u1", name: "Sam", email: "sam@example.com", image: null });
    mocks.issue.mockResolvedValue({ status: "email-failed" });
    const res = await register(req({ name: "Sam", email: "sam@example.com", password: "supersecret1" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ needsConfirmation: true, emailSent: false });
  });
  it("returns field errors for bad input (400) without touching the database", async () => {
    const res = await register(req({ name: "", email: "bad", password: "x" }));
    expect(res.status).toBe(400);
    expect(Object.keys((await res.json()).fields)).toEqual(["name", "email", "password"]);
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
  it("rejects invalid JSON (400)", async () => expect((await register(req("{oops", true))).status).toBe(400));
  it("returns 409 for a taken email", async () => {
    mocks.createUser.mockRejectedValue(new EmailTakenError());
    expect((await register(req({ name: "Sam", email: "sam@example.com", password: "supersecret1" }))).status).toBe(409);
  });
  it("hides internal errors (500)", async () => {
    mocks.createUser.mockRejectedValue(new Error("connection string leaked: postgres://secret"));
    const res = await register(req({ name: "Sam", email: "sam@example.com", password: "supersecret1" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("postgres");
  });
});

describe("/api/history", () => {
  it("requires sign-in for both GET and POST (401)", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await historyGet(new NextRequest("http://localhost/api/history"))).status).toBe(401);
    expect((await historyPost(req({ session }))).status).toBe(401);
    expect(mocks.saveUserSession).not.toHaveBeenCalled();
  });

  it("saves under the signed-in user's id, ignoring any user id in the body", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", email: "sam@example.com" } });
    const res = await historyPost(req({ session: { ...session, userId: "someone-else", user_id: "someone-else" } }));
    expect(res.status).toBe(201);
    expect(mocks.saveUserSession).toHaveBeenCalledWith({ id: "u1", email: "sam@example.com" }, expect.objectContaining({ id: "s1" }));
  });

  it("rejects invalid sessions (400) and oversized bodies (413)", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", email: "sam@example.com" } });
    expect((await historyPost(req({ session: { ...session, averageScore: 99 } }))).status).toBe(400);
    expect((await historyPost(req("not json", true))).status).toBe(400);
    expect((await historyPost(req("x".repeat(1_000_001), true))).status).toBe(413);
    expect(mocks.saveUserSession).not.toHaveBeenCalled();
  });

  it("returns the user's own sessions", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", email: "sam@example.com" } });
    mocks.getUserSessions.mockResolvedValue([session]);
    const res = await historyGet(new NextRequest("http://localhost/api/history"));
    expect(res.status).toBe(200);
    expect(mocks.getUserSessions).toHaveBeenCalledWith("u1");
    expect((await res.json()).sessions).toHaveLength(1);
  });

  it("hides database errors (500)", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", email: "sam@example.com" } });
    mocks.saveUserSession.mockRejectedValue(new Error("relation does not exist"));
    const res = await historyPost(req({ session }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("relation");
  });
});

describe("POST /api/auth/confirm-email", () => {
  it("verifies (200)", async () => {
    mocks.confirm.mockResolvedValue({ status: "verified" });
    const res = await confirmRoute(req({ email: "sam@example.com", code: "123456" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verified: true });
  });
  it("rejects malformed codes before touching the database (400)", async () => {
    for (const code of ["12345", "abcdef", "1234567", 123456, undefined]) {
      expect((await confirmRoute(req({ email: "sam@example.com", code }))).status).toBe(400);
    }
    expect((await confirmRoute(req({ code: "123456" }))).status).toBe(400);
    expect((await confirmRoute(req("{x", true))).status).toBe(400);
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("maps outcomes to stable codes", async () => {
    mocks.confirm.mockResolvedValueOnce({ status: "invalid", attemptsLeft: 3 });
    let res = await confirmRoute(req({ email: "a@b.co", code: "111111" }));
    expect([res.status, await res.json()]).toEqual([400, expect.objectContaining({ code: "INVALID_CODE", attemptsLeft: 3 })]);
    mocks.confirm.mockResolvedValueOnce({ status: "expired" });
    res = await confirmRoute(req({ email: "a@b.co", code: "111111" }));
    expect([res.status, (await res.json()).code]).toEqual([400, "CODE_EXPIRED"]);
    mocks.confirm.mockResolvedValueOnce({ status: "locked" });
    res = await confirmRoute(req({ email: "a@b.co", code: "111111" }));
    expect([res.status, (await res.json()).code]).toEqual([429, "TOO_MANY_ATTEMPTS"]);
    mocks.confirm.mockResolvedValueOnce({ status: "busy" });
    expect((await confirmRoute(req({ email: "a@b.co", code: "111111" }))).status).toBe(409);
  });
  it("hides internal errors (500)", async () => {
    mocks.confirm.mockRejectedValue(new Error("db password is hunter2"));
    const res = await confirmRoute(req({ email: "a@b.co", code: "111111" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
  });
});

describe("POST /api/auth/resend-confirmation", () => {
  it("answers the same for real, unknown and verified emails", async () => {
    mocks.issue.mockResolvedValueOnce({ status: "sent" }).mockResolvedValueOnce({ status: "nothing-to-do" });
    const a = await (await resendRoute(req({ email: "real@example.com" }))).json();
    const b = await (await resendRoute(req({ email: "unknown@example.com" }))).json();
    expect(a).toEqual(b);
  });
  it("reports the cooldown without error status", async () => {
    mocks.issue.mockResolvedValue({ status: "cooldown", retryAfterSeconds: 40 });
    const res = await resendRoute(req({ email: "real@example.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, sent: false, retryAfterSeconds: 40 });
  });
  it("reports a failed send (502) and validates input (400)", async () => {
    mocks.issue.mockResolvedValue({ status: "email-failed" });
    expect((await resendRoute(req({ email: "real@example.com" }))).status).toBe(502);
    expect((await resendRoute(req({}))).status).toBe(400);
  });
});
