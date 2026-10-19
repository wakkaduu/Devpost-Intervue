// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transcribe: vi.fn() }));
vi.mock("@/lib/transcribe", async (orig) => ({ ...(await orig<typeof import("@/lib/transcribe")>()), transcribeAudio: mocks.transcribe }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/transcribe/route";

const upload = (blob?: Blob, extra?: Record<string, string>) => {
  const form = new FormData();
  if (blob) form.append("file", blob, "a");
  return new NextRequest("http://localhost/api/transcribe", { method: "POST", body: form, headers: extra });
};
const audio = (bytes = 2000, type = "audio/webm") => new Blob([new Uint8Array(bytes)], { type });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("POST /api/transcribe", () => {
  it("returns the transcript (200)", async () => {
    mocks.transcribe.mockResolvedValue({ ok: true, text: "I led the project", provider: "groq" });
    const res = await POST(upload(audio()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "I led the project", provider: "groq" });
  });
  it("rejects missing, tiny, huge and non-audio files before calling any provider", async () => {
    expect((await POST(upload())).status).toBe(400);
    expect((await POST(upload(audio(100)))).status).toBe(400);
    expect((await POST(upload(audio(10 * 1024 * 1024 + 1)))).status).toBe(413);
    expect((await POST(upload(audio(2000, "application/pdf")))).status).toBe(415);
    expect((await POST(new NextRequest("http://localhost/api/transcribe", { method: "POST", body: "plain", headers: { "content-type": "text/plain" } }))).status).toBe(400);
    expect(mocks.transcribe).not.toHaveBeenCalled();
  });
  it("maps outcomes: silence is 422, outage is 502, and nothing internal leaks", async () => {
    mocks.transcribe.mockResolvedValueOnce({ ok: false, reason: "no-speech" });
    expect((await POST(upload(audio()))).status).toBe(422);
    mocks.transcribe.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    expect((await POST(upload(audio()))).status).toBe(502);
    mocks.transcribe.mockRejectedValueOnce(new Error("key gsk_secret leaked"));
    const res = await POST(upload(audio()));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("gsk_secret");
  });
});
