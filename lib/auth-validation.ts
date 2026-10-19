// Validation rules for sign-up, shared by the API route and the sign-up form.
export const PASSWORD_MIN = 8;
// bcrypt only uses the first 72 bytes of a password, so longer ones would be silently truncated.
export const PASSWORD_MAX_BYTES = 72;
export const NAME_MAX = 80;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

export function validateRegistration(body: unknown): { ok: true; value: { name: string; email: string; password: string } } | { ok: false; errors: FieldErrors } {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const errors: FieldErrors = {};
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!name) errors.name = "Enter your name.";
  else if (name.length > NAME_MAX) errors.name = `Name must be ${NAME_MAX} characters or fewer.`;

  if (!email) errors.email = "Enter your email.";
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";

  if (password.length < PASSWORD_MIN) errors.password = `Password must be at least ${PASSWORD_MIN} characters.`;
  else if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) errors.password = "Password is too long (72 bytes at most).";

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: { name, email, password } };
}
