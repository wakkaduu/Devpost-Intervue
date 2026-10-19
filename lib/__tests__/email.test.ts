import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSmtpConfig, sendConfirmationEmail, type EmailDeps } from "@/lib/email";

const env = (over: Record<string, string | undefined> = {}) => ({ SMTP_USER: "intervue@gmail.com", SMTP_PASSWORD: "abcd efgh ijkl mnop", ...over });
const deps = (e: Record<string, string | undefined>, sendMail = vi.fn(async () => ({}))) => {
  const createTransport = vi.fn(() => ({ sendMail }));
  return { d: { createTransport, env: e } as unknown as EmailDeps, sendMail, createTransport };
};
const msg = { to: "a@b.co", name: "Sam", code: "123456" };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("readSmtpConfig", () => {
  it("defaults to Gmail over SSL, sending from the login address", () => {
    expect(readSmtpConfig(env())).toEqual({
      host: "smtp.gmail.com", port: 465, secure: true, user: "intervue@gmail.com", pass: "abcdefghijklmnop", from: "Intervue <intervue@gmail.com>",
    });
  });
  it("strips the spaces Google puts in app passwords", () => {
    expect(readSmtpConfig(env({ SMTP_PASSWORD: "  abcd efgh  ijkl mnop " }))!.pass).toBe("abcdefghijklmnop");
  });
  it("uses a custom server, port, security mode and sender", () => {
    const c = readSmtpConfig(env({ SMTP_HOST: "smtp.example.com", SMTP_PORT: "587", EMAIL_FROM: "Hello <hi@example.com>" }))!;
    expect(c).toMatchObject({ host: "smtp.example.com", port: 587, secure: false, from: "Hello <hi@example.com>" });
    expect(readSmtpConfig(env({ SMTP_PORT: "587", SMTP_SECURE: "true" }))!.secure).toBe(true);
  });
  it("is null without a username and password", () => {
    expect(readSmtpConfig({})).toBeNull();
    expect(readSmtpConfig({ SMTP_USER: "a@b.co" })).toBeNull();
    expect(readSmtpConfig({ SMTP_PASSWORD: "x" })).toBeNull();
  });
});

describe("sendConfirmationEmail", () => {
  it("sends the code over SMTP with sensible timeouts", async () => {
    const { d, sendMail, createTransport } = deps(env());
    expect(await sendConfirmationEmail(msg, d)).toEqual({ ok: true });
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "intervue@gmail.com", pass: "abcdefghijklmnop" }, connectionTimeout: 10_000 }));
    const mail = (sendMail.mock.calls[0] as unknown as [Record<string, string>])[0];
    expect(mail).toMatchObject({ from: "Intervue <intervue@gmail.com>", to: "a@b.co" });
    expect(mail.subject).toContain("123456");
    expect(mail.text).toContain("123456");
    expect(mail.html).toContain("123456");
  });

  it("requires encryption before sending the password on a STARTTLS port, except for a local test server", async () => {
    const remote = deps(env({ SMTP_HOST: "smtp-relay.brevo.com", SMTP_PORT: "587" }));
    await sendConfirmationEmail(msg, remote.d);
    expect(remote.createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: false, requireTLS: true }));
    const ssl = deps(env());
    await sendConfirmationEmail(msg, ssl.d);
    expect(ssl.createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true, requireTLS: false }));
    const local = deps(env({ SMTP_HOST: "127.0.0.1", SMTP_PORT: "2525", SMTP_SECURE: "false" }));
    await sendConfirmationEmail(msg, local.d);
    expect(local.createTransport).toHaveBeenCalledWith(expect.objectContaining({ requireTLS: false }));
  });

  it("escapes the name so it can't inject HTML into the email", async () => {
    const { d, sendMail } = deps(env());
    await sendConfirmationEmail({ ...msg, name: '<img src=x onerror="alert(1)">' }, d);
    const html = (sendMail.mock.calls[0] as unknown as [{ html: string }])[0].html;
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("returns a generic failure that doesn't leak the server's message, and logs the reason for the developer", async () => {
    const boom = vi.fn(async () => { throw Object.assign(new Error("535 secret-detail"), { code: "EAUTH" }); });
    const { d } = deps(env({ NODE_ENV: "production" }), boom);
    const r = await sendConfirmationEmail(msg, d);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("secret-detail");
    expect((console.error as any).mock.calls.flat().join(" ")).toMatch(/app password/);
    expect((console.error as any).mock.calls.flat().join(" ")).not.toContain("abcdefghijklmnop");
  });

  it("never logs the SMTP password", async () => {
    const { d } = deps(env({ NODE_ENV: "development" }), vi.fn(async () => { throw new Error("connect ETIMEDOUT"); }));
    await sendConfirmationEmail(msg, d);
    const all = [...(console.error as any).mock.calls, ...(console.warn as any).mock.calls, ...(console.log as any).mock.calls].flat().join(" ");
    expect(all).not.toContain("abcdefghijklmnop");
  });

  it("in development, a failed send prints the code in the server log so sign-up can still be tested", async () => {
    const { d } = deps(env({ NODE_ENV: "development" }), vi.fn(async () => { throw new Error("ETIMEDOUT"); }));
    const r = await sendConfirmationEmail(msg, d);
    expect(r.ok).toBe(false); // the person is still told it could not be sent
    expect((console.warn as any).mock.calls.flat().join(" ")).toContain("123456");
  });

  it("in production, a failed send never prints the code", async () => {
    const { d } = deps(env({ NODE_ENV: "production" }), vi.fn(async () => { throw new Error("ETIMEDOUT"); }));
    await sendConfirmationEmail(msg, d);
    const all = [...(console.error as any).mock.calls, ...(console.warn as any).mock.calls, ...(console.log as any).mock.calls].flat().join(" ");
    expect(all).not.toContain("123456");
  });

  it("without SMTP settings: logs the code in development, fails in production", async () => {
    expect(await sendConfirmationEmail(msg, deps({ NODE_ENV: "development" }).d)).toEqual({ ok: true });
    expect((console.log as any).mock.calls.flat().join(" ")).toContain("123456");
    expect((await sendConfirmationEmail(msg, deps({ NODE_ENV: "production" }).d)).ok).toBe(false);
  });
});
