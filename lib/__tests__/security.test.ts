// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  LIMITS, RateLimiter, clientIp, limiter, loginLockedFor, recordLoginFailure, recordLoginSuccess,
} from "@/lib/security/rate-limiter";
import { jsonError, rateLimit, readJson } from "@/lib/http";
import { maskEmail } from "@/lib/security/logger";

let clock = 1_000_000;
const fresh = () => new RateLimiter(new Map(), () => clock);

beforeEach(() => {
  clock = 1_000_000;
  limiter.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("RateLimiter", () => {
  it("allows up to the limit, then blocks and says how long to wait", () => {
    const l = fresh();
    for (let i = 0; i < LIMITS.review.max; i++) expect(l.hit("review", "1.1.1.1").allowed).toBe(true);
    const blocked = l.hit("review", "1.1.1.1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("starts a fresh window after the time is up", () => {
    const l = fresh();
    for (let i = 0; i < LIMITS.review.max + 5; i++) l.hit("review", "ip");
    clock += LIMITS.review.windowMs + 1;
    expect(l.hit("review", "ip").allowed).toBe(true);
  });

  it("counts each caller and each limit separately", () => {
    const l = fresh();
    for (let i = 0; i < LIMITS.debrief.max; i++) l.hit("debrief", "a");
    expect(l.hit("debrief", "a").allowed).toBe(false);
    expect(l.hit("debrief", "b").allowed).toBe(true);
    expect(l.hit("review", "a").allowed).toBe(true);
  });

  it("peeking does not count", () => {
    const l = fresh();
    for (let i = 0; i < 50; i++) l.peek("debrief", "a");
    expect(l.hit("debrief", "a").remaining).toBe(LIMITS.debrief.max - 1);
  });

  it("does not grow without bound when flooded with new keys", () => {
    const map = new Map();
    const l = new RateLimiter(map, () => clock);
    for (let i = 0; i < 12_000; i++) l.hit("review", `ip-${i}`);
    expect(map.size).toBeLessThanOrEqual(10_000);
  });
});

describe("sign-in lockout", () => {
  it("locks after 5 failures for that account from that address, and reports the wait", () => {
    for (let i = 0; i < 4; i++) recordLoginFailure("9.9.9.9", "sam@example.com");
    expect(loginLockedFor("9.9.9.9", "sam@example.com")).toBe(0);
    recordLoginFailure("9.9.9.9", "sam@example.com");
    expect(loginLockedFor("9.9.9.9", "SAM@example.com")).toBeGreaterThan(0);
  });

  it("does not lock the same account for a different address", () => {
    for (let i = 0; i < 5; i++) recordLoginFailure("9.9.9.9", "sam@example.com");
    expect(loginLockedFor("8.8.8.8", "sam@example.com")).toBe(0);
  });

  it("locks an address that tries many different accounts", () => {
    for (let i = 0; i < LIMITS.loginIp.max; i++) recordLoginFailure("7.7.7.7", `user${i}@example.com`);
    expect(loginLockedFor("7.7.7.7", "someone-new@example.com")).toBeGreaterThan(0);
  });

  it("a successful sign-in clears that account's failures", () => {
    for (let i = 0; i < 4; i++) recordLoginFailure("9.9.9.9", "sam@example.com");
    recordLoginSuccess("9.9.9.9", "sam@example.com");
    recordLoginFailure("9.9.9.9", "sam@example.com");
    expect(loginLockedFor("9.9.9.9", "sam@example.com")).toBe(0);
  });
});

describe("clientIp", () => {
  it("takes the first forwarded address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
  it("caps the length so a giant header can't be used as a key", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "a".repeat(500) })).length).toBeLessThanOrEqual(64);
  });
});

describe("HTTP helpers", () => {
  const req = (body: string, headers: Record<string, string> = {}, ip = "5.5.5.5") =>
    new NextRequest("http://localhost/api/x", { method: "POST", body, headers: { "x-forwarded-for": ip, ...headers } });

  it("jsonError has one shape", async () => {
    const r = jsonError(418, "nope", "TEAPOT", { extra: 1 });
    expect(r.status).toBe(418);
    expect(await r.json()).toEqual({ error: "nope", code: "TEAPOT", extra: 1 });
  });

  it("rateLimit passes until the limit, then returns 429 with Retry-After and a message", async () => {
    for (let i = 0; i < LIMITS.transcribe.max; i++) expect(rateLimit(req("{}"), "transcribe")).toBeNull();
    const res = rateLimit(req("{}"), "transcribe")!;
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    const body = await res.json();
    expect(body).toMatchObject({ code: "RATE_LIMITED" });
    expect(body.error).toMatch(/Too many requests/);
    expect(rateLimit(req("{}", {}, "6.6.6.6"), "transcribe")).toBeNull(); // someone else is unaffected
  });

  it("readJson parses good JSON", async () => {
    const r = await readJson(req('{"a":1}'));
    expect(r).toEqual({ ok: true, body: { a: 1 } });
  });

  it("readJson rejects bad JSON (400) and oversized bodies (413)", async () => {
    const bad = await readJson(req("{oops"));
    expect(!bad.ok && bad.response.status).toBe(400);
    const big = await readJson(req(JSON.stringify({ x: "y".repeat(200) })), 100);
    expect(!big.ok && big.response.status).toBe(413);
    const declared = await readJson(req("{}", { "content-length": "999999" }), 1000);
    expect(!declared.ok && declared.response.status).toBe(413);
  });
});

describe("maskEmail", () => {
  it("keeps the domain and first letter only", () => {
    expect(maskEmail("Sam.Jones@Example.com")).toBe("s***@example.com");
    expect(maskEmail("garbage")).toBe("***");
  });
});
