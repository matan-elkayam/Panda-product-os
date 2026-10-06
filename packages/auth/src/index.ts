import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { Pool } from 'pg';
import { z } from 'zod';
import { verifyPassword } from './passwords';

let pool: Pool | undefined;
function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required at runtime');
  pool ??= new Pool({ connectionString, max: 5 });
  return pool;
}

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(12).max(256),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const result = await getPool().query<{
          id: string;
          email: string;
          name: string | null;
          password_hash: string | null;
        }>(
          'SELECT id, email, name, password_hash FROM users WHERE lower(email) = $1 LIMIT 1',
          [parsed.data.email],
        );
        const user = result.rows[0];
        if (!user?.password_hash) return null;
        if (!(await verifyPassword(parsed.data.password, user.password_hash))) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  pages: { signIn: '/login' },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-panda.session-token' : 'panda.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  trustHost: true,
});
