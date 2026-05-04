
import { NextResponse } from 'next/server';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const response = NextResponse.json({ success: true, message: 'Logout bem-sucedido.' });
        
        // Apaga os dois cookies de sessão definindo uma data de expiração no passado
        response.cookies.set({
            name: 'session_token',
            value: '',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: -1,
        });
        
        response.cookies.set({
            name: '__session',
            value: '',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: -1,
        });

        return response;

    } catch (error) {
        console.error('Erro no endpoint de logout:', error);
        return NextResponse.json({ error: 'Erro interno do servidor.', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
