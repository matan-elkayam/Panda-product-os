import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PostgresAdapter } from "@auth/pg-adapter";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is required");

const pool = new Pool({ connectionString });

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(pool),
  session: { strategy: "database" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async () => {
        // Password verification is intentionally not stubbed insecurely.
        // M0 will wire a password hashing service before enabling credentials login.
        return null;
      },
    }),
  ],
  pages: { signIn: "/login" },
  trustHost: true,
});
