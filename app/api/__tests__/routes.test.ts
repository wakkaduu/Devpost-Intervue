import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createUser: vi.fn(),
  saveUserSession: vi.fn(),
  getUserSessions: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({
  createUser: mocks.createUser,
  saveUserSession: mocks.saveUserSession,
  getUserSessions: mocks.getUserSessions,
  EmailTakenError: class EmailTakenError extends Error {},
}));

import { NextRequest } from "next/server";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as historyGet, POST as historyPost } from "@/app/api/history/route";
import { EmailTakenError } from "@/lib/db";

const req = (body: unknown, raw = false) =>
  new NextRequest("http://localhost/api/x", { method: "POST", body: raw ? (body as string) : JSON.stringify(body) });

const session = {
  id: "s1", category: "Behavioral", mode: "typed", averageScore: 7, questionCount: 1,
  entries: [{ question: "q", answer: "a", durationSec: 5 }], createdAt: "2026-03-01T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/auth/register", () => {
  it("creates an account (201) and returns no password data", async () => {
    mocks.createUser.mockResolvedValue({ id: "u1", name: "Sam", email: "sam@example.com", image: null });
    const res = await register(req({ name: "Sam", email: "sam@example.com", password: "supersecret1" }));
    expect(res.status).toBe(201);
    expect(JSON.stringify(await res.json())).not.toMatch(/password|hash/i);
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
    expect((await historyGet()).status).toBe(401);
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
    const res = await historyGet();
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
