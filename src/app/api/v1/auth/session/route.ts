// src/app/api/v1/auth/session/route.ts
import { NextResponse } from 'next/server';

/**
 * @deprecated Esta rota foi descontinuada e a sua funcionalidade movida para uma Server Action.
 * Este handler existe apenas para prevenir erros de compilação ('File is not a module').
 */

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json(
        { error: 'This endpoint is deprecated and should not be used.' },
        { status: 410 } // 410 Gone
    );
}
