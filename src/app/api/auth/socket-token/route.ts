import { NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { SignJWT } from 'jose';

// JWT Secret (lido por requisição para evitar chaves obsoletas)


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const secret = process.env.JWT_SECRET_KEY_CALL;
        if (!secret) {
            return NextResponse.json(
                { error: 'JWT_SECRET_KEY_CALL not configured' },
                { status: 500 }
            );
        }

        const session = await getUserSession();

        if (!session.user || session.error) {
            return NextResponse.json(
                { error: 'Not authenticated', details: session.error },
                { status: 401 }
            );
        }

        const secretKey = new TextEncoder().encode(secret);
        console.log(`[Token Gen Debug] Secret Length: ${secret.length}, Prefix: ${secret.substring(0, 3)}...`);

        const socketToken = await new SignJWT({
            userId: session.user.id,
            companyId: session.user.companyId,
            email: session.user.email,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(secretKey);

        return NextResponse.json({
            token: socketToken,
            userId: session.user.id,
            companyId: session.user.companyId,
            email: session.user.email
        });

    } catch (error) {
        console.error('Error getting socket token:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}