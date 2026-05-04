// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

// [FIX] Force secure cookies and trust proxy for Replit environments (HTTPS).
// Mismatch between HTTP (internal) and HTTPS (external) often breaks OAuth State verification.
const handler = NextAuth({
  ...authConfig,
  useSecureCookies: process.env.NODE_ENV === 'production' || !!process.env.REPLIT_SLUG,
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true
      }
    }
  },
  debug: false, 
});

export { handler as GET, handler as POST };
