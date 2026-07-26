import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { basePrisma } from "./lib/prisma"
import bcrypt from "bcryptjs"

import Google from "next-auth/providers/google"

declare module "next-auth" {
  interface User {
    id?: string;
    role?: string;
    roleId?: string;
    orgId?: string;
    isSuperAdmin?: boolean;
  }
  interface Session {
    user: User & {
      id: string;
      role?: string;
      roleId?: string;
      orgId?: string;
      isSuperAdmin?: boolean;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(basePrisma),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await basePrisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { role: true }
        })

        if (!user || !user.password) {
          return null
        }

        const isValid = await bcrypt.compare(credentials.password as string, user.password)

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role?.name || 'team_member',
          roleId: user.roleId || undefined,
          orgId: user.orgId,
          isSuperAdmin: user.isSuperAdmin,
        }
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.roleId = user.roleId
        token.id = user.id
        token.picture = user.image
        token.orgId = user.orgId
        token.isSuperAdmin = user.isSuperAdmin
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = (token.role as string) || 'team_member'
        session.user.roleId = token.roleId as string | undefined
        session.user.orgId = token.orgId as string | undefined
        session.user.isSuperAdmin = token.isSuperAdmin as boolean | undefined
        if (token.picture) {
          session.user.image = token.picture as string
        }
      }
      return session
    }
  },
  pages: {
    signIn: '/login', // Adjust if login route is different
  },
})
