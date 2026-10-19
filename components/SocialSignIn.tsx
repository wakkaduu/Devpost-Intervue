"use client";

import { signIn } from "next-auth/react";
import type { ReactNode } from "react";
import { FacebookIcon, GithubIcon, GoogleIcon } from "@/components/ui/BrandIcons";
import { safeCallbackPath } from "@/lib/safe-redirect";

export interface SocialAvailability {
  github: boolean;
  google: boolean;
  facebook: boolean;
}

const PROVIDERS: { id: keyof SocialAvailability; label: string; icon: ReactNode }[] = [
  { id: "github", label: "GitHub", icon: <GithubIcon /> },
  { id: "google", label: "Google", icon: <GoogleIcon /> },
  { id: "facebook", label: "Facebook", icon: <FacebookIcon /> },
];

/**
 * The social sign-in row. Every button is always clickable. If the server has that provider's keys, it starts the
 * sign-in; if not, `onUnavailable` is told so the page can explain, instead of sending people to an error page.
 * `availability` is null while the server is still being asked, in which case the click goes straight through.
 */
export default function SocialSignIn({
  availability,
  callbackUrl,
  onUnavailable,
}: {
  availability: SocialAvailability | null;
  callbackUrl?: string;
  onUnavailable?: (label: string) => void;
}) {
  return (
    <div role="group" aria-label="Sign in with another account" className="grid gap-2 sm:grid-cols-3">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-label={`Continue with ${p.label}`}
          onClick={() => {
            if (availability && !availability[p.id]) onUnavailable?.(p.label);
            else void signIn(p.id, { callbackUrl: safeCallbackPath(callbackUrl) });
          }}
          className="flex min-h-[44px] items-center justify-center gap-2.5 rounded-xl border border-sage-400 bg-white px-3 text-sm font-bold text-darkslate-900 transition duration-200 hover:-translate-y-0.5 hover:border-forest-600 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 active:translate-y-0"
        >
          {p.icon}
          {p.label}
        </button>
      ))}
    </div>
  );
}
