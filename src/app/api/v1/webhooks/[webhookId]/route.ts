import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { webhookSubscriptions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';

const webhookEventTypes = [
  'conversation_created',
  'conversation_updated',
  'message_received',
  'message_sent',
  'lead_created',
  'lead_stage_changed',
  'sale_closed',
  'meeting_scheduled',
  'campaign_sent',
  'campaign_completed',
] as const;

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(webhookEventTypes)).min(1).optional(),
  active: z.boolean().optional(),
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { webhookId } = await params;
    const body = await request.json();
    const validation = updateWebhookSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const existing = await db.query.webhookSubscriptions.findFirst({
      where: and(
        eq(webhookSubscriptions.id, webhookId),
        eq(webhookSubscriptions.companyId, companyId)
      ),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Webhook não encontrado' }, { status: 404 });
    }

    const updateData: any = {};
    if (validation.data.name !== undefined) updateData.name = validation.data.name;
    if (validation.data.url !== undefined) updateData.url = validation.data.url;
    if (validation.data.events !== undefined) updateData.events = validation.data.events;
    if (validation.data.active !== undefined) updateData.active = validation.data.active;

    const [updated] = await db
      .update(webhookSubscriptions)
      .set(updateData)
      .where(
        and(
          eq(webhookSubscriptions.id, webhookId),
          eq(webhookSubscriptions.companyId, companyId)
        )
      )
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[Webhooks] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar webhook' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { webhookId } = await params;

    const existing = await db.query.webhookSubscriptions.findFirst({
      where: and(
        eq(webhookSubscriptions.id, webhookId),
        eq(webhookSubscriptions.companyId, companyId)
      ),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Webhook não encontrado' }, { status: 404 });
    }

    await db
      .delete(webhookSubscriptions)
      .where(
        and(
          eq(webhookSubscriptions.id, webhookId),
          eq(webhookSubscriptions.companyId, companyId)
        )
      );

    return NextResponse.json({ success: true, message: 'Webhook deletado com sucesso' });
  } catch (error) {
    console.error('[Webhooks] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao deletar webhook' },
      { status: 500 }
    );
  }
}
