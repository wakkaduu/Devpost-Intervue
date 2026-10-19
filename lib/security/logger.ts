// Security events as one JSON line each. Never log passwords, codes, tokens or full email addresses.
export type SecurityEvent = "RATE_LIMITED" | "LOGIN_FAILED" | "LOGIN_LOCKED" | "LOGIN_SUCCESS" | "BAD_REQUEST";

/** "sam@example.com" -> "s***@example.com": enough to recognise an account in a log without storing the address. */
export function maskEmail(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split("@");
  return domain ? `${local.slice(0, 1)}***@${domain}` : "***";
}

export function logSecurityEvent(event: SecurityEvent, details: Record<string, string | number | undefined>): void {
  console.warn(JSON.stringify({ type: "security", event, at: new Date().toISOString(), ...details }));
}
