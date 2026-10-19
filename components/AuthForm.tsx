"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Button from "@/components/ui/Button";
import { validateRegistration, type FieldErrors } from "@/lib/auth-validation";
import { safeCallbackPath } from "@/lib/safe-redirect";
import ErrorMessage from "@/components/ui/ErrorMessage";
import SegmentedControl from "@/components/ui/SegmentedControl";
import PasswordInput from "@/components/ui/PasswordInput";

type Mode = "signin" | "signup";

function Field({ id, label, error, type, ...input }: { id: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block text-sm font-semibold text-darkslate-700">{label}</label>
      {type === "password" ? (
        <PasswordInput id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} {...input} />
      ) : (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1 min-h-[44px] w-full rounded-xl border border-sage-400 bg-white px-3 text-darkslate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          type={type}
          {...input}
        />
      )}
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

const OAUTH_ERRORS: Record<string, string> = {
  AccessDenied: "We couldn't sign you in with that account. Make sure its email address is verified with the provider, or use email and password.",
  OAuthAccountNotLinked: "That email is already used by another sign-in method. Sign in the way you did before.",
};

export default function AuthForm({ callbackUrl, authError }: { callbackUrl?: string; authError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [providers, setProviders] = useState<{ google: boolean; github: boolean }>({ google: false, github: false });

  // Show a social button only for providers the server has configured.
  useEffect(() => {
    fetch("/api/auth/providers-available")
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const oauthError = authError ? (OAUTH_ERRORS[authError] ?? "Sign-in didn't work. Please try again.") : null;

  async function logIn() {
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.code === "rate_limited") {
      setError("Too many sign-in attempts. Please wait a few minutes and try again.");
      return false;
    }
    if (res?.code === "email_not_verified") {
      setStep("confirm");
      setNotice("Confirm your email to finish signing in. We're sending you a new code.");
      await resend();
      return false;
    }
    if (!res || res.error) {
      setError("That email and password don't match. Check them and try again.");
      return false;
    }
    router.push(safeCallbackPath(callbackUrl));
    router.refresh();
    return true;
  }

  async function resend() {
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "We couldn't send a new code.");
        return;
      }
      if (data.sent === false) {
        setCooldown(data.retryAfterSeconds ?? 60);
        setNotice("A code was sent a moment ago. Check your email, or wait to request another.");
      } else {
        setCooldown(60);
        setNotice(`We sent a new 6-digit code to ${email.trim()}.`);
      }
    } catch {
      setError("We couldn't send a new code. Check your connection and try again.");
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/confirm-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "INVALID_CODE") {
          const left = data.attemptsLeft ?? 0;
          setError(`That code isn't right. ${left === 1 ? "1 try" : `${left} tries`} left.`);
        } else {
          setError(data.error ?? "We couldn't check that code.");
        }
        return;
      }
      setStep("form");
      setCode("");
      setNotice(null);
      if (!(await logIn())) setMode("signin");
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    if (mode === "signup") {
      const check = validateRegistration({ name, email, password });
      if (!check.ok) {
        setFields(check.errors);
        return;
      }
    } else if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFields(data.fields ?? {});
          setError(data.error ?? "We couldn't create your account.");
          return;
        }
        setStep("confirm");
        if (data.emailSent) {
          setNotice(`We sent a 6-digit code to ${email.trim()}. It expires in 15 minutes.`);
          setCooldown(60);
        } else {
          setNotice("Your account is created, but we couldn't send the email. Press “Send a new code”.");
        }
        return;
      }
      await logIn();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setFields({});
  };

  if (step === "confirm") {
    return (
      <div className="rounded-2xl bg-sage-100 p-5 sm:p-6 text-darkslate-900">
        <form onSubmit={confirm} noValidate>
          <h1 className="text-xl font-bold">Check your email</h1>
          {notice && <p role="status" className="mt-2 text-sm text-darkslate-700">{notice}</p>}
          <Field
            id="code"
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          {error && <ErrorMessage className="mt-4">{error}</ErrorMessage>}
          <div className="mt-5 space-y-2">
            <Button type="submit" size="lg" fullWidth loading={busy}>Confirm email</Button>
            <Button variant="secondary" size="lg" fullWidth disabled={cooldown > 0} onClick={() => void resend()}>
              {cooldown > 0 ? `Send a new code (${cooldown}s)` : "Send a new code"}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => { setStep("form"); setError(null); setNotice(null); setCode(""); }}>
              Back
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-sage-100 p-5 sm:p-6 text-darkslate-900">
      <SegmentedControl
        label="Sign in or create an account"
        fill
        value={mode}
        onChange={switchTo}
        options={[{ value: "signin", label: "Sign in" }, { value: "signup", label: "Create account" }]}
      />

      {(providers.google || providers.github) && (
        <div className="mt-4 space-y-2">
          {providers.google && (
            <Button variant="secondary" size="lg" fullWidth onClick={() => signIn("google", { callbackUrl: safeCallbackPath(callbackUrl) })}>
              Continue with Google
            </Button>
          )}
          {providers.github && (
            <Button variant="secondary" size="lg" fullWidth onClick={() => signIn("github", { callbackUrl: safeCallbackPath(callbackUrl) })}>
              Continue with GitHub
            </Button>
          )}
          <p className="pt-1 text-center text-xs text-darkslate-600">or use your email</p>
        </div>
      )}
      {oauthError && <ErrorMessage className="mt-4">{oauthError}</ErrorMessage>}

      <form onSubmit={submit} noValidate className="mt-2">
        <h1 className="mt-3 text-xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-darkslate-600">Your account keeps your practice history across devices.</p>

        {mode === "signup" && (
          <Field id="name" label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={fields.name} />
        )}
        <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fields.password}
        />
        {mode === "signup" && !fields.password && <p className="mt-1 text-xs text-darkslate-600">At least 8 characters.</p>}

        {error && <ErrorMessage className="mt-4">{error}</ErrorMessage>}

        <div className="mt-5">
          <Button type="submit" size="lg" fullWidth loading={busy}>{mode === "signin" ? "Sign in" : "Create account"}</Button>
        </div>
      </form>
    </div>
  );
}
