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
 * The social sign-in row. Every provider is shown with its icon so people can see what is coming; the ones
 * that aren't set up yet are disabled and say "Soon". `availability` is null while the server is being asked.
 */
export default function SocialSignIn({ availability, callbackUrl }: { availability: SocialAvailability | null; callbackUrl?: string }) {
  return (
    <div role="group" aria-label="Sign in with another account" className="grid gap-2 sm:grid-cols-3">
      {PROVIDERS.map((p) => {
        const loading = availability === null;
        const enabled = !loading && availability[p.id];
        return (
          <button
            key={p.id}
            type="button"
            disabled={!enabled}
            aria-label={enabled || loading ? `Continue with ${p.label}` : `Continue with ${p.label} (coming soon)`}
            onClick={() => signIn(p.id, { callbackUrl: safeCallbackPath(callbackUrl) })}
            className={[
              "relative flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl border px-3 text-sm font-bold transition duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
              enabled
                ? "border-sage-400 bg-white text-darkslate-900 hover:-translate-y-0.5 hover:border-forest-600 hover:shadow-card active:translate-y-0"
                : "cursor-not-allowed border-sage-300 bg-white/50 text-darkslate-600",
            ].join(" ")}
          >
            <span className={enabled || loading ? "" : "opacity-50 grayscale"}>{p.icon}</span>
            {p.label}
            {!loading && !enabled && (
              <span className="absolute -top-2 right-2 rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-900 ring-1 ring-gold-300">Soon</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
