// src/app/api/auth/providers-status/route.ts
import { NextResponse } from 'next/server';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET() {
  const hasGoogleCredentials = !!(
    process.env.GOOGLE_CLIENT_ID && 
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_ID.trim() !== '' &&
    process.env.GOOGLE_CLIENT_SECRET.trim() !== ''
  );

  const hasFacebookCredentials = !!(
    process.env.FACEBOOK_CLIENT_ID && 
    process.env.FACEBOOK_CLIENT_SECRET &&
    process.env.FACEBOOK_CLIENT_ID.trim() !== '' &&
    process.env.FACEBOOK_CLIENT_SECRET.trim() !== ''
  );

  return NextResponse.json({
    google: hasGoogleCredentials,
    facebook: hasFacebookCredentials,
  });
}
