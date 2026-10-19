import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { isEmailVerified, verifyUserCredentials } from "@/lib/db";
import { availableProviders, resolveOAuthSignIn } from "@/lib/oauth";
import { clientIp, loginLockedFor, recordLoginFailure, recordLoginSuccess } from "@/lib/security/rate-limiter";
import { logSecurityEvent, maskEmail } from "@/lib/security/logger";

const enabled = availableProviders();

/** Right password, but the email hasn't been confirmed yet. The login form turns this into the "enter your code" step. */
class EmailNotVerified extends CredentialsSignin {
  code = "email_not_verified";
}

/** Too many failed attempts from this address: the login form shows a "wait a few minutes" message. */
class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Auth.js reads AUTH_SECRET from the environment. It is required in production.
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      id: "credentials",
      name: "Email and password",
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password || email.length > 254 || password.length > 1000) return null;

        const ip = clientIp(request.headers);
        // Locked out? Refuse before checking the password at all, so a lock can't be used to test guesses.
        const wait = loginLockedFor(ip, email);
        if (wait > 0) {
          logSecurityEvent("LOGIN_LOCKED", { ip, account: maskEmail(email), retryAfterSeconds: wait });
          throw new TooManyAttempts();
        }

        try {
          const user = await verifyUserCredentials(email, password);
          if (!user) {
            recordLoginFailure(ip, email);
            logSecurityEvent("LOGIN_FAILED", { ip, account: maskEmail(email) });
            return null;
          }
          if ((await isEmailVerified(user.email)) === false) throw new EmailNotVerified();
          recordLoginSuccess(ip, email);
          return { id: user.id, name: user.name, email: user.email, image: user.image };
        } catch (err) {
          if (err instanceof EmailNotVerified) throw err;
          console.error("[auth] sign-in lookup failed:", err);
          return null;
        }
      },
    }),
    // A provider only exists when both its id and secret are set, so the login page can hide the button otherwise.
    ...(enabled.google ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })] : []),
    ...(enabled.github ? [GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET })] : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") return true;
      try {
        const id = await resolveOAuthSignIn({
          provider: account.provider,
          accessToken: account.access_token,
          user,
          profile: profile as { email_verified?: boolean } | undefined,
        });
        if (!id) return false;
        user.id = id; // replace the provider's id with ours, so history is tied to our account
        return true;
      } catch (err) {
        console.error("[auth] OAuth sign-in failed:", err);
        return false;
      }
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
