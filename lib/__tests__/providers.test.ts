import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { basicReview } from "@/lib/basic-grader";
import { evaluateAnswer, configuredProviders, withTimeout, type Provider } from "@/lib/evaluator";
import { requestGroq } from "@/lib/groq-llm";
import { validateFeedback } from "@/lib/validation";
import type { Feedback, ReviewRequest } from "@/types";

const req: ReviewRequest = { question: "Tell me about a time you led a project.", answer: "I led the migration of our billing system and we cut errors by 40% after launch.", category: "Behavioral", mode: "typed" };
const fb = (score: number): Feedback => ({
  score, summary: "s", strengths: ["a"], areasForImprovement: ["b"], focusNext: "f", strongerVersion: "v",
  followUpQuestion: "q?", howTheyAnswered: "h", toneAnalysis: "t", questionConnection: "c",
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("basic grader", () => {
  it("returns a complete review that passes the same validation as an AI one", () => {
    expect(() => validateFeedback(basicReview(req))).not.toThrow();
  });
  it("is honest that it is basic, and never gives a top score", () => {
    const r = basicReview({ ...req, answer: "I led it and delivered 10 results with 5 people. ".repeat(20) });
    expect(r.summary).toMatch(/basic feedback/i);
    expect(r.score).toBeLessThanOrEqual(7);
  });
  it("scores a one-line answer low and tells the person why", () => {
    const r = basicReview({ ...req, answer: "It went fine." });
    expect(r.score).toBeLessThanOrEqual(3);
    expect(r.areasForImprovement.join(" ")).toMatch(/3 words/);
  });
  it("rewards specifics and flags hedging and hidden ownership", () => {
    const strong = basicReview(req);
    const weak = basicReview({ ...req, answer: "Maybe we kind of did it, I guess, and we thought we could, and our team and we hoped it was fine overall for everyone." });
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(weak.areasForImprovement.join(" ")).toMatch(/“we”|maybe/i);
  });
  it("does not invent facts in its rewrite", () => {
    expect(basicReview(req).strongerVersion).toContain("[");
  });
});

describe("provider chain", () => {
  const ok = (name: Provider["name"], score: number): Provider => ({ name, run: async () => fb(score) });
  const bad = (name: Provider["name"]): Provider => ({ name, run: async () => { throw new Error("down"); } });

  it("uses Gemini when it works", async () => {
    const r = await evaluateAnswer(req, [ok("gemini", 8), ok("groq", 5)]);
    expect(r).toMatchObject({ score: 8, source: "ai", provider: "gemini" });
  });
  it("falls back to Groq when Gemini fails", async () => {
    expect(await evaluateAnswer(req, [bad("gemini"), ok("groq", 5)])).toMatchObject({ score: 5, source: "ai", provider: "groq" });
  });
  it("falls back to the basic grader when every provider fails, or none is configured", async () => {
    expect(await evaluateAnswer(req, [bad("gemini"), bad("groq")])).toMatchObject({ source: "basic", provider: "basic" });
    expect(await evaluateAnswer(req, [])).toMatchObject({ source: "basic", provider: "basic" });
  });
  it("moves on from a provider that hangs, so one slow service can't block the next", async () => {
    const hang: Provider = { name: "gemini", run: () => new Promise<Feedback>(() => {}) };
    const r = await evaluateAnswer(req, [hang, ok("groq", 6)], 50);
    expect(r.provider).toBe("groq");
  });
  it("withTimeout rejects after the budget", async () => {
    await expect(withTimeout(new Promise(() => {}), 20, "x")).rejects.toThrow(/timed out/);
  });
  it("builds the chain from the keys that are set, Gemini first", () => {
    expect(configuredProviders(req, {}).map((p) => p.name)).toEqual([]);
    expect(configuredProviders(req, { GROQ_API_KEY: "g" }).map((p) => p.name)).toEqual(["groq"]);
    expect(configuredProviders(req, { GEMINI_API_KEY: "a", GROQ_API_KEY: "g" }).map((p) => p.name)).toEqual(["gemini", "groq"]);
  });
});

describe("Groq reviewer", () => {
  const reply = (content: string) => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) });
  it("parses and validates a JSON reply, sending the key as a bearer token", async () => {
    const fetchMock = vi.fn(async () => reply(JSON.stringify(fb(7))));
    vi.stubGlobal("fetch", fetchMock);
    expect((await requestGroq(req, "gsk_x")).score).toBe(7);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("api.groq.com");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer gsk_x");
    expect(JSON.parse(init.body as string).response_format).toEqual({ type: "json_object" });
  });
  it("retries once when the model returns an invalid review", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply('{"score": 99}')).mockResolvedValueOnce(reply(JSON.stringify(fb(6))));
    vi.stubGlobal("fetch", fetchMock);
    expect((await requestGroq(req, "k")).score).toBe(6);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("throws on an HTTP error so the chain can move on", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })));
    await expect(requestGroq(req, "k")).rejects.toThrow(/429/);
  });
});
