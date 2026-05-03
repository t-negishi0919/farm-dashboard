import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/** カンマ区切りの環境変数を allowlist に整形 */
function loadAllowedEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30, // 30 日
    updateAge: 60 * 60 * 24,   // 1 日でローテート
  },
  trustHost: true,
  callbacks: {
    /** Google アカウントがリストに無ければ拒否 */
    async signIn({ user }) {
      const email = user.email?.toLowerCase() ?? "";
      const allowed = loadAllowedEmails();
      if (allowed.length === 0) {
        // 設定漏れ防止: allowlist が空なら誰も入れない
        console.error("ALLOWED_EMAILS is empty; rejecting all sign-ins");
        return false;
      }
      return allowed.includes(email);
    },
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      return token;
    },
    async session({ session, token }) {
      if (token.email && session.user) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },
});
