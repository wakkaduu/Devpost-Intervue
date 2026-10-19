import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyUserCredentials } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Auth.js reads AUTH_SECRET from the environment. It is required in production.
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      id: "credentials",
      name: "Email and password",
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;
        try {
          const user = await verifyUserCredentials(email, password);
          return user ? { id: user.id, name: user.name, email: user.email, image: user.image } : null;
        } catch (err) {
          console.error("[auth] sign-in lookup failed:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
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
