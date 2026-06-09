
import { NextResponse } from 'next/server';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const response = NextResponse.json({ success: true, message: 'Logout bem-sucedido.' });
        
        const clearOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax' as const,
            path: '/',
            maxAge: 0,
        };

        response.cookies.set('session_token', '', clearOptions);
        response.cookies.set('__session', '', clearOptions);
        response.cookies.set('next-auth.session-token', '', clearOptions);
        response.cookies.set('__Secure-next-auth.session-token', '', { ...clearOptions, secure: true });

        return response;

    } catch (error) {
        console.error('Erro no endpoint de logout:', error);
        return NextResponse.json({ error: 'Erro interno do servidor.', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
