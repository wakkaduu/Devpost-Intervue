// Server-only: sends the confirmation email through Resend's REST API.
export interface EmailResult {
  ok: boolean;
  error?: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export async function sendConfirmationEmail(input: { to: string; name: string; code: string }): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") return { ok: false, error: "Email is not configured." };
    // Local development without a Resend key: show the code in the server terminal instead of emailing it.
    console.log(`[email] RESEND_API_KEY not set. Confirmation code for ${input.to}: ${input.code}`);
    return { ok: true };
  }

  const from = process.env.EMAIL_FROM?.trim() || "Intervue <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: `Your Intervue confirmation code: ${input.code}`,
        text: `Hi ${input.name},\n\nYour Intervue confirmation code is ${input.code}. It expires in 15 minutes.\n\nIf you didn't create an account, you can ignore this email.`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;color:#23382B">Confirm your email</h1>
  <p>Hi ${escapeHtml(input.name)}, use this code to finish creating your Intervue account:</p>
  <p style="font-size:32px;font-weight:800;letter-spacing:6px;background:#E2ECE5;padding:12px 20px;border-radius:10px;display:inline-block">${input.code}</p>
  <p style="color:#52606D;font-size:14px">It expires in 15 minutes. If you didn't create an account, you can ignore this email.</p>
</div>`,
      }),
    });
    if (!res.ok) {
      // Log Resend's reason for us; never show provider details to the user.
      const reason = await res.text();
      console.error(`[email] Resend rejected the message (${res.status}):`, reason);
      if (process.env.NODE_ENV !== "production" && res.status === 403 && /testing emails|verify a domain/i.test(reason)) {
        // Resend's free sender only delivers to the account owner's own address. While developing, print the code
        // here so sign-up can still be tested with any email. This never happens in production.
        console.warn(`[email] DEV ONLY: Resend's test sender can't deliver to ${input.to}. Confirmation code: ${input.code}. To email real users, verify a domain at resend.com/domains.`);
      }
      return { ok: false, error: "The email could not be sent." };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] sending failed:", err);
    return { ok: false, error: "The email could not be sent." };
  }
}
