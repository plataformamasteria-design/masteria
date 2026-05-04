import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth.config';
import { NextRequest, NextResponse } from 'next/server';

export async function requireSuperAdmin(_req?: NextRequest) {
  const session = await getServerSession(authConfig);
  
  if (!session || !session.user) {
    return {
      error: 'Unauthorized - no session',
      status: 401,
      data: null,
    };
  }

  if (session.user.role !== 'superadmin') {
    return {
      error: 'Forbidden - superadmin only',
      status: 403,
      data: null,
    };
  }

  return {
    error: null,
    status: 200,
    data: session.user,
  };
}

export function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function createSuccessResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status });
}
