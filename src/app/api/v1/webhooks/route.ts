import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { webhookSubscriptions } from '@/lib/db/schema';
import { eq, and, desc, sql, or, like } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import crypto from 'crypto';
import { z } from 'zod';

// Pagination limit constants
const MAX_LIMIT = 50; // Maximum records per request to prevent performance issues
const DEFAULT_LIMIT = 10;

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

const createWebhookSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(255),
  url: z.string().url('URL inválida'),
  events: z.array(z.enum(webhookEventTypes)).min(1, 'Pelo menos um evento é necessário'),
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    // Enforce maximum limit to prevent performance issues
    const requestedLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT));
    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    const whereConditions = [eq(webhookSubscriptions.companyId, companyId)];

    if (search) {
      whereConditions.push(
        or(
          like(webhookSubscriptions.name, `%${search}%`),
          like(webhookSubscriptions.url, `%${search}%`)
        )!
      );
    }

    const [subscriptions, totalResult] = await Promise.all([
      db
        .select()
        .from(webhookSubscriptions)
        .where(and(...whereConditions))
        .orderBy(desc(webhookSubscriptions.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(webhookSubscriptions)
        .where(and(...whereConditions)),
    ]);

    const total = totalResult[0]?.count || 0;

    return NextResponse.json({
      data: subscriptions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Webhooks] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar webhooks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createWebhookSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, url, events } = validation.data;

    const secret = crypto.randomBytes(32).toString('hex');

    const [newSubscription] = await db
      .insert(webhookSubscriptions)
      .values({
        companyId,
        name,
        url,
        secret,
        events: events as any,
        active: true,
      })
      .returning();

    return NextResponse.json(newSubscription, { status: 201 });
  } catch (error) {
    console.error('[Webhooks] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar webhook' },
      { status: 500 }
    );
  }
}
