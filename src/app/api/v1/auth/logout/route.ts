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
        
        // Limpar ambos os cookies de sessão com configurações explícitas
        response.cookies.set('__session', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 0, // Expira imediatamente
        });
        
        response.cookies.set('session_token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 0, // Expira imediatamente
        });

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