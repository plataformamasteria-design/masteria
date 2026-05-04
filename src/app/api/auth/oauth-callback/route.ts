import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { SignJWT } from 'jose';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY_CALL;
if (!JWT_SECRET_KEY) {
  throw new Error('JWT_SECRET_KEY_CALL não está definida.');
}
const secretKey = new TextEncoder().encode(JWT_SECRET_KEY);


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);

    if (!session || !session.user) {
      return NextResponse.redirect(new URL('/login?error=oauth_session_not_found', request.url));
    }

    const userId = session.user.id;
    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResults.length === 0) {
      return NextResponse.redirect(new URL('/login?error=usuario_nao_encontrado', request.url));
    }

    const user = userResults[0];

    if (!user) {
      return NextResponse.redirect(new URL('/login?error=usuario_nao_encontrado', request.url));
    }

    const token = await new SignJWT({
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secretKey);

    const { searchParams } = new URL(request.url);
    let redirectUrl = searchParams.get('redirect') || '/dashboard';

    if (redirectUrl.startsWith('//')) {
      redirectUrl = '/dashboard';
    } else if (!redirectUrl.startsWith('/')) {
      try {
        const redirectUrlObj = new URL(redirectUrl);
        const requestUrlObj = new URL(request.url);

        if (redirectUrlObj.origin !== requestUrlObj.origin) {
          redirectUrl = '/dashboard';
        }
      } catch {
        redirectUrl = '/dashboard';
      }
    }

    // [FIX] Define explicit Public URL for Replit environment
    const PUBLIC_URL = 'https://62863c59-d08b-44f5-a414-d7529041de1a-00-16zuyl87dp7m9.kirk.replit.dev';

    // Construct the absolute URL using the public domain
    // We ignore request.url origin because it might be 0.0.0.0:5000
    const finalRedirectUrl = new URL(redirectUrl, PUBLIC_URL);

    const response = NextResponse.redirect(finalRedirectUrl);

    response.cookies.set('__session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=oauth_callback_failed', request.url));
  }
}
