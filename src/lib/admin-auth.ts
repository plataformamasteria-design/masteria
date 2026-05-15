import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';

export async function requireSuperAdmin(_req?: NextRequest) {
  try {
    const session = await getUserSession();
    
    if (session.error || !session.user) {
      return {
        error: session.error || 'Unauthorized - no session',
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
  } catch (error: any) {
    return {
      error: error.message || 'Internal server error',
      status: 500,
      data: null,
    };
  }
}

export function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function createSuccessResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status });
}
