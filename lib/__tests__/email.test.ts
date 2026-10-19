import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendConfirmationEmail } from "@/lib/email";

const env = { ...process.env };
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("sendConfirmationEmail", () => {
  it("sends through Resend with the key in the header and the code in the message", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Intervue <onboarding@resend.dev>";
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendConfirmationEmail({ to: "a@b.co", name: "Sam", code: "123456" })).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ from: "Intervue <onboarding@resend.dev>", to: ["a@b.co"] });
    expect(body.subject).toContain("123456");
    expect(body.text).toContain("123456");
  });

  it("escapes the name so it can't inject HTML into the email", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "" }));
    vi.stubGlobal("fetch", fetchMock);
    await sendConfirmationEmail({ to: "a@b.co", name: '<img src=x onerror="alert(1)">', code: "123456" });
    const html = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).html as string;
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("returns a generic failure, without provider details, when Resend rejects it", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, text: async () => "domain not verified: secret-detail" })));
    const r = await sendConfirmationEmail({ to: "a@b.co", name: "Sam", code: "123456" });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("secret-detail");
  });

  it("returns a failure when the network is down", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect((await sendConfirmationEmail({ to: "a@b.co", name: "Sam", code: "123456" })).ok).toBe(false);
  });

  it("without a key, logs the code in development but fails in production", async () => {
    delete process.env.RESEND_API_KEY;
    expect(await sendConfirmationEmail({ to: "a@b.co", name: "Sam", code: "123456" })).toEqual({ ok: true });
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect((await sendConfirmationEmail({ to: "a@b.co", name: "Sam", code: "123456" })).ok).toBe(false);
  });
});
