// src/app/api/v1/auth/logout/route.ts

import { NextResponse } from 'next/server';

/**
 * Rota para logout do usuário
 * Remove os cookies de sessão e invalida a sessão atual
 */

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const response = NextResponse.json({ 
            success: true, 
            message: 'Logout realizado com sucesso.' 
        });
        
        const clearOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax' as const,
            path: '/',
            maxAge: 0,
        };
        
        response.cookies.set('__session', '', clearOptions);
        response.cookies.set('session_token', '', clearOptions);
        response.cookies.set('next-auth.session-token', '', clearOptions);
        response.cookies.set('__Secure-next-auth.session-token', '', { ...clearOptions, secure: true });

        return response;

    } catch (error) {
        console.error('Erro no endpoint de logout:', error);
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        return NextResponse.json({ 
            error: 'Erro interno do servidor.', 
            details: errorMessage 
        }, { status: 500 });
    }
}

// Permitir OPTIONS para CORS
export async function OPTIONS() {
    return new NextResponse(null, { 
        status: 200, 
        headers: {
            'Allow': 'POST, OPTIONS',
            'Cache-Control': 'no-store',
        }
    });
}