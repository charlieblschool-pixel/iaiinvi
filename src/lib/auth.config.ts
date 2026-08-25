import type { NextAuthConfig } from "next-auth";
import { prisma } from "@/lib/prisma";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async signIn({ user, account }) {
      // Google already verifies the email ownership on its side, so treat
      // Google sign-ins as verified — don't nag those users to click a link
      // we'd send to an address Google already confirmed.
      if (account?.provider === "google" && user?.email) {
        await prisma.user.updateMany({
          where: { email: user.email, emailVerified: null },
          data: { emailVerified: new Date() },
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
