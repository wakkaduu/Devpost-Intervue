// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ synth: vi.fn() }));
vi.mock("@/lib/tts", () => ({ synthesizeSpeech: mocks.synth }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/speak/route";
import { limiter, LIMITS } from "@/lib/security/rate-limiter";
import { getQuestions } from "@/lib/questions";

const QUESTION = getQuestions("Behavioral")[0].text;
const post = (body: unknown, ip = "1.2.3.4") =>
  new NextRequest("http://localhost/api/speak", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "x-forwarded-for": ip, "content-type": "application/json" } });

beforeEach(() => {
  limiter.clear();
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/speak", () => {
  it("returns the question as WAV audio the browser may cache", async () => {
    mocks.synth.mockResolvedValue(Buffer.from("RIFFdata"));
    const res = await POST(post({ text: QUESTION }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect(res.headers.get("cache-control")).toContain("max-age");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("RIFFdata");
    expect(mocks.synth).toHaveBeenCalledWith(QUESTION);
  });

  it("reads only questions from our own bank, never arbitrary text", async () => {
    for (const body of [{ text: "Read this essay aloud" }, { text: QUESTION + " extra" }, { text: 42 }, {}, "null", { text: ["x"] }]) {
      const res = await POST(post(body));
      expect(res.status).toBe(400);
    }
    expect(mocks.synth).not.toHaveBeenCalled();
  });

  it("rejects bad JSON and oversized bodies before doing anything", async () => {
    expect((await POST(post("{oops"))).status).toBe(400);
    expect((await POST(post({ text: "x".repeat(10_000) }))).status).toBe(413);
    expect(mocks.synth).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    mocks.synth.mockResolvedValue(Buffer.from("RIFF"));
    for (let i = 0; i < LIMITS.speak.max; i++) expect((await POST(post({ text: QUESTION }))).status).toBe(200);
    const res = await POST(post({ text: QUESTION }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect((await POST(post({ text: QUESTION }, "9.9.9.9"))).status).toBe(200);
  });

  it("hides internal errors", async () => {
    mocks.synth.mockRejectedValue(new Error("GEMINI_API_KEY=secret leaked at /srv/app"));
    const res = await POST(post({ text: QUESTION }));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret|\/srv/);
  });
});
