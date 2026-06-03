import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "./lib/prisma"
import bcrypt from "bcryptjs"
import { $Enums } from "@prisma/client"

declare module "next-auth" {
  interface User {
    id?: string;
    role?: $Enums.UserRole;
  }
  interface Session {
    user: User & {
      id: string;
      role?: $Enums.UserRole;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string }
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
          role: user.role,
        }
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        // @ts-ignore
        session.user.role = token.role as string
      }
      return session
    }
  },
  pages: {
    signIn: '/login', // Adjust if login route is different
  },
})
