// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

// [FIX] Force secure cookies and trust proxy for Replit environments (HTTPS).
// Mismatch between HTTP (internal) and HTTPS (external) often breaks OAuth State verification.
const isSecure = process.env.NODE_ENV === 'production' || !!process.env.REPLIT_SLUG;

const handler = NextAuth({
  ...authConfig,
  useSecureCookies: isSecure,
  debug: false, 
});

export { handler as GET, handler as POST };
