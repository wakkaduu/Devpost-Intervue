import { describe, expect, it, vi } from "vitest";
import { availableProviders, resolveOAuthSignIn, type OAuthDeps } from "@/lib/oauth";

const deps = (emails: { email: string; primary: boolean; verified: boolean }[] = []): OAuthDeps & { upsertUser: ReturnType<typeof vi.fn> } => ({
  fetchGithubEmails: vi.fn(async () => emails),
  upsertUser: vi.fn(async () => ({ id: "our-id", name: "N", email: "e", image: null })),
});

describe("resolveOAuthSignIn", () => {
  it("lets Google sign in when the provider says the email is verified", async () => {
    const d = deps();
    const id = await resolveOAuthSignIn({ provider: "google", user: { email: "A@Example.com", name: "A" }, profile: { email_verified: true } }, d);
    expect(id).toBe("our-id");
    expect(d.upsertUser).toHaveBeenCalledWith(expect.objectContaining({ email: "a@example.com" }));
  });

  it("refuses Google when the email is not verified or the flag is missing", async () => {
    const d = deps();
    expect(await resolveOAuthSignIn({ provider: "google", user: { email: "a@example.com" }, profile: { email_verified: false } }, d)).toBeNull();
    expect(await resolveOAuthSignIn({ provider: "google", user: { email: "a@example.com" }, profile: {} }, d)).toBeNull();
    expect(d.upsertUser).not.toHaveBeenCalled();
  });

  it("lets GitHub sign in only if that exact email is verified on the GitHub account", async () => {
    const d = deps([{ email: "a@example.com", primary: true, verified: true }]);
    expect(await resolveOAuthSignIn({ provider: "github", accessToken: "t", user: { email: "a@example.com" } }, d)).toBe("our-id");
    const unverified = deps([{ email: "a@example.com", primary: true, verified: false }]);
    expect(await resolveOAuthSignIn({ provider: "github", accessToken: "t", user: { email: "a@example.com" } }, unverified)).toBeNull();
    const other = deps([{ email: "different@example.com", primary: true, verified: true }]);
    expect(await resolveOAuthSignIn({ provider: "github", accessToken: "t", user: { email: "a@example.com" } }, other)).toBeNull();
  });

  it("refuses GitHub without an access token, and any sign-in without an email", async () => {
    const d = deps([{ email: "a@example.com", primary: true, verified: true }]);
    expect(await resolveOAuthSignIn({ provider: "github", user: { email: "a@example.com" } }, d)).toBeNull();
    expect(await resolveOAuthSignIn({ provider: "google", user: { email: null }, profile: { email_verified: true } }, d)).toBeNull();
  });

  it("refuses unknown providers", async () => {
    expect(await resolveOAuthSignIn({ provider: "evil", user: { email: "a@example.com" } }, deps())).toBeNull();
  });
});

describe("availableProviders", () => {
  it("needs both id and secret", () => {
    expect(availableProviders({})).toEqual({ google: false, github: false });
    expect(availableProviders({ AUTH_GOOGLE_ID: "x" })).toEqual({ google: false, github: false });
    expect(availableProviders({ AUTH_GOOGLE_ID: "x", AUTH_GOOGLE_SECRET: "y", AUTH_GITHUB_ID: "a", AUTH_GITHUB_SECRET: "b" })).toEqual({ google: true, github: true });
  });
});
