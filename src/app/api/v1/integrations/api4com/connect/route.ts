import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { crmIntegrations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const api4comConfigSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  defaultExtension: z.string().min(1, 'Ramal padrão é obrigatório'),
  baseUrl: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    const body = await request.json();

    const parsed = api4comConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    const { token, defaultExtension, baseUrl } = parsed.data;

    const existing = await db
      .select()
      .from(crmIntegrations)
      .where(and(eq(crmIntegrations.companyId, companyId), eq(crmIntegrations.provider, 'api4com')));

    if (existing.length > 0) {
      await db
        .update(crmIntegrations)
        .set({
          status: 'connected',
          config: {
            token,
            defaultExtension,
            baseUrl: baseUrl || 'https://api.api4com.com/api/v1'
          },
          updatedAt: new Date()
        })
        .where(eq(crmIntegrations.id, existing[0].id));
    } else {
      await db.insert(crmIntegrations).values({
        companyId,
        provider: 'api4com',
        status: 'connected',
        config: {
          token,
          defaultExtension,
          baseUrl: baseUrl || 'https://api.api4com.com/api/v1'
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving API4COM config:', error);
    const message = error instanceof Error ? error.message : 'Erro interno ao salvar configuração';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
