// Server-only: sends the confirmation email over SMTP with nodemailer.
// Works with Gmail (use an app password), or any SMTP service, by changing the SMTP_* settings.
import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

export interface EmailResult {
  ok: boolean;
  error?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/** Reads the SMTP settings. Returns null when no username and password are set. */
export function readSmtpConfig(env: Record<string, string | undefined> = process.env): SmtpConfig | null {
  const user = env.SMTP_USER?.trim();
  // Google shows app passwords in groups ("abcd efgh ijkl mnop"); the spaces are not part of the password.
  const pass = env.SMTP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) return null;
  const port = Number(env.SMTP_PORT) || 465;
  return {
    host: env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
    user,
    pass,
    from: env.EMAIL_FROM?.trim() || `Intervue <${user}>`,
  };
}

export interface EmailDeps {
  createTransport: (options: SMTPTransport.Options) => Pick<Transporter, "sendMail">;
  env: Record<string, string | undefined>;
}

const defaultDeps: EmailDeps = { createTransport: (o) => nodemailer.createTransport(o), env: process.env };

const transports = new Map<string, Pick<Transporter, "sendMail">>();
function transportFor(config: SmtpConfig, deps: EmailDeps) {
  if (deps !== defaultDeps) return deps.createTransport(transportOptions(config)); // tests get a fresh one each time
  const key = `${config.host}:${config.port}:${config.secure}:${config.user}`;
  let t = transports.get(key);
  if (!t) {
    t = deps.createTransport(transportOptions(config));
    transports.set(key, t);
  }
  return t;
}

const isLocalHost = (host: string) => ["localhost", "127.0.0.1", "::1"].includes(host);

function transportOptions(c: SmtpConfig): SMTPTransport.Options {
  return {
    host: c.host,
    port: c.port,
    secure: c.secure,
    // On a STARTTLS port (such as 587) refuse to send the password unless the connection is encrypted first.
    // A mail server on this same machine (used for testing) is the only exception.
    requireTLS: !c.secure && !isLocalHost(c.host),
    auth: { user: c.user, pass: c.pass },
    // Don't let a stuck mail server hold a sign-up request open.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export async function sendConfirmationEmail(
  input: { to: string; name: string; code: string },
  deps: EmailDeps = defaultDeps
): Promise<EmailResult> {
  const config = readSmtpConfig(deps.env);
  const isProduction = deps.env.NODE_ENV === "production";

  if (!config) {
    if (isProduction) return { ok: false, error: "Email is not configured." };
    // Local development without SMTP settings: show the code in the server terminal instead of emailing it.
    console.log(`[email] SMTP_USER / SMTP_PASSWORD not set. Confirmation code for ${input.to}: ${input.code}`);
    return { ok: true };
  }

  try {
    await transportFor(config, deps).sendMail({
      from: config.from,
      to: input.to,
      subject: `Your Intervue confirmation code: ${input.code}`,
      text: `Hi ${input.name},\n\nYour Intervue confirmation code is ${input.code}. It expires in 15 minutes.\n\nIf you didn't create an account, you can ignore this email.`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;color:#23382B">Confirm your email</h1>
  <p>Hi ${escapeHtml(input.name)}, use this code to finish creating your Intervue account:</p>
  <p style="font-size:32px;font-weight:800;letter-spacing:6px;background:#E2ECE5;padding:12px 20px;border-radius:10px;display:inline-block">${input.code}</p>
  <p style="color:#52606D;font-size:14px">It expires in 15 minutes. If you didn't create an account, you can ignore this email.</p>
</div>`,
    });
    return { ok: true };
  } catch (err) {
    // Log the reason for the developer (never the password); the user only ever sees a generic message.
    const e = err as { code?: string; responseCode?: number; message?: string };
    console.error(`[email] SMTP send failed (${e.code ?? e.responseCode ?? "error"}):`, e.message);
    if (e.code === "EAUTH") {
      console.error("[email] The SMTP server rejected the login. For Gmail, SMTP_PASSWORD must be an app password (Google account > Security > App passwords), not your normal password.");
    }
    if (!isProduction) {
      // While developing, still let sign-up be tested: print the code here. This never happens in production.
      console.warn(`[email] DEV ONLY: could not email ${input.to}. Confirmation code: ${input.code}`);
    }
    return { ok: false, error: "The email could not be sent." };
  }
}
