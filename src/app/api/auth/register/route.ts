// src/app/api/auth/register/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users, companies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getBaseUrl } from '@/utils/get-base-url';
import { checkAuthRateLimit, getClientIp } from '@/lib/rate-limiter';

const createExpirationDate = (hours: number): Date => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
};

const registerSchema = z.object({
  name: z.string().min(2, 'O nome é obrigatório.'),
  email: z.string().email('Email inválido.'),
  password: z.string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres.')
    .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula.')
    .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula.')
    .regex(/[0-9]/, 'A senha deve conter pelo menos um número.'),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
    const ip = getClientIp(request.headers);
    const rateLimit = await checkAuthRateLimit(ip, 'cadastro');
    
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: rateLimit.message || 'Muitas tentativas. Tente novamente mais tarde.' }, { status: 429 });
    }

    const requestId = randomUUID().slice(0, 8);
    console.log(`[REGISTER:${requestId}] Iniciando processo de registro. IP: ${ip}`);
    
    try {
        const body = await request.json();
        const parsed = registerSchema.safeParse(body);
        
        if (!parsed.success) {
            console.log(`[REGISTER:${requestId}] Validação falhou:`, parsed.error.flatten());
            return NextResponse.json({ error: 'Dados de registo inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }
        
        const { name, email, password } = parsed.data;
        console.log(`[REGISTER:${requestId}] Processando registro para: ${email}`);

        const [existingUser] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
        if (existingUser) {
            console.log(`[REGISTER:${requestId}] Email já existe: ${email}`);
            return NextResponse.json({ error: 'Já existe uma conta com este email.' }, { status: 409 });
        }

        const passwordHash = await hash(password, 10);
        const baseUrl = getBaseUrl();
        console.log(`[REGISTER:${requestId}] Base URL: ${baseUrl}`);
        
        const result = await db.transaction(async (tx) => {
            const companyName = `${name}'s Company - ${randomUUID().slice(0, 4)}`;
            const [newCompany] = await tx.insert(companies).values({ name: companyName }).returning();
            if (!newCompany) {
                throw new Error("Falha ao criar empresa durante o registo.");
            }
            console.log(`[REGISTER:${requestId}] Empresa criada: ${newCompany.id}`);
            
            const [createdUser] = await tx.insert(users).values({
                name,
                email: email.toLowerCase(),
                password: passwordHash,
                firebaseUid: `native_${randomUUID()}`,
                role: 'admin',
                companyId: newCompany.id,
                emailVerified: new Date(),
            }).returning({ id: users.id, name: users.name, email: users.email });

            if (!createdUser) {
                throw new Error("Falha ao criar o utilizador no banco de dados.");
            }
            console.log(`[REGISTER:${requestId}] Usuário criado: ${createdUser.id}`);
            
            return { user: createdUser };
        });

        console.log(`[REGISTER:${requestId}] Transação concluída com sucesso`);
        
        return NextResponse.json({ 
            success: true, 
            message: 'Conta criada com sucesso!',
            requestId
        }, { status: 201 });

    } catch (error) {
        console.error(`[REGISTER:${requestId}] Erro no endpoint de registo:`, error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
