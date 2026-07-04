
// src/app/api/auth/login/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';
import { z } from 'zod';
import { compare } from 'bcryptjs';
import { withRateLimit } from '@/middleware/rate-limit.middleware';

const loginSchema = z.object({
  email: z.string().email('Email inválido.'),
  password: z.string().min(1, 'Senha é obrigatória.'),
});

const getJwtSecretKey = () => {
    const secret = process.env.JWT_SECRET_KEY_CALL || 'dummy_secret_key';
    
    return new TextEncoder().encode(secret);
};

async function handler(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = loginSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados de login inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }

        const { email, password } = parsed.data;

                // 1. Encontrar o utilizador pelo e-mail e o alias de superadmin (mesmo email, senhas diferentes)
        const { or } = await import('drizzle-orm');
        const matchingUsers = await db
            .select()
            .from(users)
            .where(
                or(
                    eq(users.email, email.toLowerCase()),
                    eq(users.email, `superadmin:${email.toLowerCase()}`)
                )
            );

        if (matchingUsers.length === 0) {
            return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 });
        }
        
        let authenticatedUser = null;

        // 2. Comparar a senha fornecida com o hash guardado de cada usuário encontrado
        for (const u of matchingUsers) {
            if (u.password) {
                const isPasswordValid = await compare(password, u.password);
                if (isPasswordValid) {
                    authenticatedUser = u;
                    break;
                }
            }
        }

        if (!authenticatedUser) {
            return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 });
        }
        
        const user = authenticatedUser;

        if (!user.emailVerified) {
          return NextResponse.json({ error: 'Confirmação de NÃO-ROBÔ! 🤖\nTe enviei um e-mail para confirmar que é você mesmo, e não uma IA ;D', user }, { status: 403 });
        }
        
        // 3. Gerar o token JWT para a nossa sessão interna
        const token = await new SignJWT({
            userId: user.id,
            companyId: user.companyId,
            email: user.email,
            role: user.role,
        })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1d') // Expira em 1 dia
        .sign(getJwtSecretKey());

        const response = NextResponse.json({ success: true, message: 'Login bem-sucedido.' });
        
        // 4. Definir os dois cookies para máxima compatibilidade
        const cookieOptions = {
            name: '__session', // Nome principal para compatibilidade com Firebase Hosting
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax' as const, 
            path: '/',
            maxAge: 60 * 60 * 24, // 1 dia em segundos
        };

        response.cookies.set(cookieOptions);
        // Fallback cookie
        response.cookies.set({ ...cookieOptions, name: 'session_token' });

        return response;

    } catch (error) {
        console.error('Erro no endpoint de login:', error);
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        return NextResponse.json({ error: 'Erro interno do servidor.', details: errorMessage }, { status: 500 });
    }
}

// Apply rate limiting to the POST handler

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export const POST = withRateLimit(handler);
