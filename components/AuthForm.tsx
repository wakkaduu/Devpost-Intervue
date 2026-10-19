"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Button from "@/components/ui/Button";
import { validateRegistration, type FieldErrors } from "@/lib/auth-validation";
import { safeCallbackPath } from "@/lib/safe-redirect";

type Mode = "signin" | "signup";

function Field({ id, label, error, ...input }: { id: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block text-sm font-semibold text-darkslate-700">{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="mt-1 min-h-[44px] w-full rounded-xl border border-sage-400 bg-white px-3 text-darkslate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
        {...input}
      />
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
  const [providers, setProviders] = useState<{ google: boolean; github: boolean }>({ google: false, github: false });

  // Show a social button only for providers the server has configured.
  useEffect(() => {
    fetch("/api/auth/providers-available")
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => {});
  }, []);

  const oauthError = authError ? (OAUTH_ERRORS[authError] ?? "Sign-in didn't work. Please try again.") : null;

  async function logIn() {
    const res = await signIn("credentials", { email, password, redirect: false });
    if (!res || res.error) {
      setError("That email and password don't match. Check them and try again.");
      return false;
    }
    router.push(safeCallbackPath(callbackUrl));
    router.refresh();
    return true;
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

  return (
    <div className="rounded-2xl bg-sage-100 p-5 sm:p-6 text-darkslate-900">
      <div role="group" aria-label="Sign in or create an account" className="grid grid-cols-2 gap-2">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => switchTo(m)}
            className={[
              "min-h-[44px] rounded-xl text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
              mode === m ? "bg-forest-700 text-white" : "border border-sage-400 bg-white text-forest-800",
            ].join(" ")}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

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
      {oauthError && <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{oauthError}</div>}

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

        {error && <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        <div className="mt-5">
          <Button type="submit" size="lg" fullWidth loading={busy}>{mode === "signin" ? "Sign in" : "Create account"}</Button>
        </div>
      </form>
    </div>
  );
}
