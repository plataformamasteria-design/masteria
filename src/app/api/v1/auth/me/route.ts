// src/app/api/v1/auth/me/route.ts
// PATCH /api/v1/auth/me — Atualiza senha e/ou email do próprio usuário logado

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { hash, compare } from 'bcryptjs';
import { jwtVerify } from 'jose';

export const dynamic = 'force-dynamic';

const getJwtSecretKey = () => {
  const secret = process.env.JWT_SECRET_KEY_CALL;
  if (!secret) throw new Error('JWT_SECRET_KEY_CALL não configurada');
  return new TextEncoder().encode(secret);
};

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatória.'),
  newPassword: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres.'),
});

const changeEmailSchema = z.object({
  newEmail: z.string().email('E-mail inválido.'),
  currentPassword: z.string().min(1, 'Confirme sua senha atual.'),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  phone: z.string().max(20).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  timezone: z.string().max(100).optional().nullable(),
});

export async function PATCH(request: NextRequest) {
  try {
    // 1. Autenticar via cookie de sessão
    const sessionToken =
      request.cookies.get('__session')?.value ||
      request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
    }

    const { payload } = await jwtVerify(sessionToken, getJwtSecretKey());
    const userId = payload.userId as string;

    if (!userId) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
    }

    // 2. Buscar usuário no banco
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    const body = await request.json();

    // ── Trocar SENHA ─────────────────────────────────────────────────────────
    if (body.action === 'change_password') {
      const parsed = changePasswordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
      }

      const { currentPassword, newPassword } = parsed.data;

      const isCurrentPasswordValid = await compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 });
      }

      const newPasswordHash = await hash(newPassword, 10);
      await db.update(users).set({ password: newPasswordHash }).where(eq(users.id, userId));

      return NextResponse.json({ success: true, message: 'Senha alterada com sucesso.' });
    }

    // ── Trocar EMAIL ──────────────────────────────────────────────────────────
    if (body.action === 'change_email') {
      const parsed = changeEmailSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
      }

      const { newEmail, currentPassword } = parsed.data;

      const isCurrentPasswordValid = await compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return NextResponse.json({ error: 'Senha incorreta. Confirme sua senha atual.' }, { status: 400 });
      }

      // Verificar se email já está em uso
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, newEmail.toLowerCase()))
        .limit(1);

      if (existing) {
        return NextResponse.json({ error: 'Este e-mail já está em uso por outro usuário.' }, { status: 409 });
      }

      await db.update(users).set({ email: newEmail.toLowerCase() }).where(eq(users.id, userId));

      return NextResponse.json({ success: true, message: 'E-mail alterado com sucesso. Faça login novamente com o novo e-mail.' });
    }

    // ── Atualizar PERFIL (nome, avatar, phone, bio, timezone) ─────────────────
    if (body.action === 'update_profile') {
      const parsed = updateProfileSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
      }
      const updates: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;
      // Store extra fields in a metadata approach via jsonb permissions field or just name+avatar for now
      // name and avatarUrl are the only DB columns available
      if (Object.keys(updates).length > 0) {
        await db.update(users).set(updates).where(eq(users.id, userId));
      }
      return NextResponse.json({ success: true, message: 'Perfil atualizado com sucesso.' });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });

  } catch (error) {
    console.error('[/api/v1/auth/me PATCH]', error);
    return NextResponse.json({ error: (error as Error).message || 'Erro interno.' }, { status: 500 });
  }
}
