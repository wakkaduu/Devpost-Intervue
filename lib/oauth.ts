// Decides whether a Google/GitHub sign-in is allowed, and which of our accounts it maps to.
import { upsertOAuthUser } from "@/lib/db";

export interface OAuthInput {
  provider: string;
  accessToken?: string;
  user: { id?: string; email?: string | null; name?: string | null; image?: string | null };
  profile?: { email_verified?: boolean } | null;
}

export interface OAuthDeps {
  fetchGithubEmails: (accessToken: string) => Promise<{ email: string; primary: boolean; verified: boolean }[]>;
  upsertUser: typeof upsertOAuthUser;
}

export const defaultDeps: OAuthDeps = {
  async fetchGithubEmails(accessToken) {
    const res = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "User-Agent": "intervue" },
    });
    if (!res.ok) throw new Error(`GitHub emails request failed (${res.status})`);
    return res.json();
  },
  upsertUser: upsertOAuthUser,
};

/**
 * Returns our account id when the sign-in is allowed, or null to refuse it.
 * Rules: the provider must vouch that the email is verified, because we link accounts by email.
 */
export async function resolveOAuthSignIn(input: OAuthInput, deps: OAuthDeps = defaultDeps): Promise<string | null> {
  const email = input.user.email?.trim().toLowerCase();
  if (!email) return null;

  if (input.provider === "google") {
    if (input.profile?.email_verified !== true) return null;
  } else if (input.provider === "github") {
    if (!input.accessToken) return null;
    const emails = await deps.fetchGithubEmails(input.accessToken);
    const match = emails.find((e) => e.email.toLowerCase() === email);
    if (!match?.verified) return null;
  } else {
    return null;
  }

  const account = await deps.upsertUser({ email, name: input.user.name, image: input.user.image });
  return account.id;
}

export function availableProviders(env: Record<string, string | undefined> = process.env) {
  return {
    google: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
    github: Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET),
  };
}
