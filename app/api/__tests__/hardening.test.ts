// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  evaluate: vi.fn(), debrief: vi.fn(), transcribe: vi.fn(), auth: vi.fn(), createUser: vi.fn(), confirm: vi.fn(), issue: vi.fn(),
}));
vi.mock("@/lib/evaluator", () => ({ evaluateAnswer: mocks.evaluate, withTimeout: (p: Promise<unknown>) => p, PROVIDER_TIMEOUT_MS: 1 }));
vi.mock("@/lib/debrief-evaluator", () => ({ requestDebrief: mocks.debrief }));
vi.mock("@/lib/transcribe", async (orig) => ({ ...(await orig<typeof import("@/lib/transcribe")>()), transcribeAudio: mocks.transcribe }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ createUser: mocks.createUser, EmailTakenError: class extends Error {}, saveUserSession: vi.fn(), getUserSessions: vi.fn() }));
vi.mock("@/lib/confirm-email", () => ({ confirmEmail: mocks.confirm, issueConfirmationCode: mocks.issue }));

import { NextRequest } from "next/server";
import { limiter, LIMITS } from "@/lib/security/rate-limiter";
import { POST as review } from "@/app/api/review/route";
import { POST as summary } from "@/app/api/review/summary/route";
import { POST as transcribe } from "@/app/api/transcribe/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as confirm } from "@/app/api/auth/confirm-email/route";
import { POST as resend } from "@/app/api/auth/resend-confirmation/route";
import { GET as historyGet, POST as historyPost } from "@/app/api/history/route";

const post = (url: string, body: string, ip = "1.2.3.4", type = "application/json") =>
  new NextRequest(`http://localhost${url}`, { method: "POST", body, headers: { "x-forwarded-for": ip, "content-type": type } });

const validReview = JSON.stringify({ question: "Q?", answer: "An answer", category: "Behavioral", mode: "typed" });
const SECRET_TEXT = "postgres://user:hunter2@db.internal/prod at /srv/app/lib/db.ts:42";

beforeEach(() => {
  limiter.clear();
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ user: { id: "u1", email: "a@b.co" } });
});

describe("every API route is rate limited, and stops before doing any work", () => {
  const cases: [string, string, string, () => (r: NextRequest) => Promise<Response>, number][] = [
    ["review", "/api/review", "{}", () => review, LIMITS.review.max],
    ["summary", "/api/review/summary", "{}", () => summary, LIMITS.debrief.max],
    ["register", "/api/auth/register", "{}", () => register, LIMITS.register.max],
    ["confirm-email", "/api/auth/confirm-email", "{}", () => confirm, LIMITS.confirmEmail.max],
    ["resend-confirmation", "/api/auth/resend-confirmation", "{}", () => resend, LIMITS.resendConfirmation.max],
    ["history POST", "/api/history", "{}", () => historyPost, LIMITS.history.max],
  ];
  it.each(cases)("%s returns 429 with Retry-After after its limit", async (_n, url, body, handler, max) => {
    for (let i = 0; i < max; i++) expect((await handler()(post(url, body))).status).not.toBe(429);
    const res = await handler()(post(url, body));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect((await res.json()).code).toBe("RATE_LIMITED");
    expect((await handler()(post(url, body, "9.9.9.9"))).status).not.toBe(429);
  });

  it("transcribe and history GET too", async () => {
    const audio = () => { const f = new FormData(); f.append("file", new Blob([new Uint8Array(10)], { type: "audio/webm" })); return new NextRequest("http://localhost/api/transcribe", { method: "POST", body: f, headers: { "x-forwarded-for": "3.3.3.3" } }); };
    for (let i = 0; i < LIMITS.transcribe.max; i++) await transcribe(audio());
    expect((await transcribe(audio())).status).toBe(429);
    const get = () => new NextRequest("http://localhost/api/history", { headers: { "x-forwarded-for": "4.4.4.4" } });
    for (let i = 0; i < LIMITS.history.max; i++) await historyGet(get());
    expect((await historyGet(get())).status).toBe(429);
  });

  it("the provider is never called once the limit is hit", async () => {
    mocks.evaluate.mockResolvedValue({ score: 5 });
    for (let i = 0; i < LIMITS.review.max; i++) await review(post("/api/review", validReview));
    mocks.evaluate.mockClear();
    await review(post("/api/review", validReview));
    expect(mocks.evaluate).not.toHaveBeenCalled();
  });
});

describe("input validation", () => {
  it.each([
    ["review", "/api/review", review],
    ["summary", "/api/review/summary", summary],
    ["register", "/api/auth/register", register],
    ["confirm-email", "/api/auth/confirm-email", confirm],
    ["resend-confirmation", "/api/auth/resend-confirmation", resend],
  ] as const)("%s rejects invalid JSON (400) and oversized bodies (413)", async (_n, url, handler) => {
    expect((await handler(post(url, "{not json"))).status).toBe(400);
    expect((await handler(post(url, JSON.stringify({ x: "y".repeat(600_000) })))).status).toBe(413);
  });

  it("rejects JSON that isn't an object, without crashing", async () => {
    for (const body of ["null", "[]", '"text"', "42"]) {
      for (const [url, h] of [["/api/review", review], ["/api/review/summary", summary], ["/api/auth/register", register], ["/api/auth/confirm-email", confirm], ["/api/auth/resend-confirmation", resend]] as const) {
        const res = await h(post(url, body));
        expect(res.status, `${url} ${body}`).toBeGreaterThanOrEqual(400);
        expect(res.status, `${url} ${body}`).toBeLessThan(500);
      }
    }
  });

  it("review enforces field rules: empty, too long, wrong types", async () => {
    const r = (o: object) => review(post("/api/review", JSON.stringify(o)));
    expect((await r({ question: "Q", answer: "   ", category: "x" })).status).toBe(400);
    expect((await r({ question: "Q", answer: "a".repeat(8001), category: "x" })).status).toBe(400);
    expect((await r({ question: 5, answer: {}, category: [] })).status).toBe(400);
    expect(mocks.evaluate).not.toHaveBeenCalled();
  });
});

describe("internal errors never reach the user", () => {
  it("review", async () => {
    mocks.evaluate.mockRejectedValue(new Error(SECRET_TEXT));
    const res = await review(post("/api/review", validReview));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/hunter2|postgres|\/srv|db\.ts/);
  });
  it("summary", async () => {
    mocks.debrief.mockRejectedValue(new Error(SECRET_TEXT));
    const body = JSON.stringify({ category: "Behavioral", entries: [1, 2].map((n) => ({ question: `Q${n}`, answer: "a", score: 5, summary: "s", focusNext: "f" })) });
    const res = await summary(post("/api/review/summary", body));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/hunter2|postgres|\/srv|db\.ts/);
  });
  it("transcribe", async () => {
    mocks.transcribe.mockRejectedValue(new Error(SECRET_TEXT));
    const f = new FormData(); f.append("file", new Blob([new Uint8Array(2000)], { type: "audio/webm" }));
    const res = await transcribe(new NextRequest("http://localhost/api/transcribe", { method: "POST", body: f }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/hunter2|postgres|\/srv|db\.ts/);
  });
  it("register", async () => {
    mocks.createUser.mockRejectedValue(new Error(SECRET_TEXT));
    const res = await register(post("/api/auth/register", JSON.stringify({ name: "Sam", email: "sam@example.com", password: "supersecret1" })));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/hunter2|postgres|\/srv|db\.ts/);
  });
  it("confirm and resend", async () => {
    mocks.confirm.mockRejectedValue(new Error(SECRET_TEXT));
    mocks.issue.mockRejectedValue(new Error(SECRET_TEXT));
    const a = await confirm(post("/api/auth/confirm-email", JSON.stringify({ email: "a@b.co", code: "123456" })));
    const b = await resend(post("/api/auth/resend-confirmation", JSON.stringify({ email: "a@b.co" })));
    expect([a.status, b.status]).toEqual([500, 500]);
    expect(JSON.stringify([await a.json(), await b.json()])).not.toMatch(/hunter2|postgres|\/srv|db\.ts/);
  });
});
