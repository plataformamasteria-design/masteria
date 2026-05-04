// src/app/api/v1/integrations/kommo/push-lead-note/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { crmIntegrations, kanbanLeads } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

const noteSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  note: z.string().min(1, 'Note content is required').max(5000, 'Note too long'),
  visibility: z.enum(['private', 'public']).default('private'),
});

export async function POST(request: NextRequest) {
  try {
    let companyId: string | null = null;
    try {
      companyId = await getCompanyIdFromSession();
    } catch (authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = noteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { leadId, note, visibility } = validation.data;

    // 1. Buscar lead no banco
    const [lead] = await db
      .select()
      .from(kanbanLeads)
      .where(eq(kanbanLeads.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 2. Buscar integração Kommo da empresa
    const [kommoIntegration] = await db
      .select()
      .from(crmIntegrations)
      .where(
        and(
          eq(crmIntegrations.companyId, companyId),
          eq(crmIntegrations.provider, 'KOMMO')
        )
      )
      .limit(1);

    if (!kommoIntegration) {
      return NextResponse.json(
        { error: 'Kommo integration not configured' },
        { status: 404 }
      );
    }

    // 3. Chamar API Kommo para adicionar nota
    const result = await pushNoteToKommo(
      (kommoIntegration as any).config || {},
      {
        leadId: lead.externalId || lead.id,
        note,
        visibility,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to push note to Kommo', details: result.error },
        { status: 500 }
      );
    }

    console.log('[Kommo] Note pushed successfully:', {
      leadId,
      noteId: result.noteId,
    });

    return NextResponse.json({
      success: true,
      message: 'Note pushed to Kommo successfully',
      noteId: result.noteId,
    });
  } catch (error) {
    console.error('[Kommo] Error pushing note:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper function to push note to Kommo API
async function pushNoteToKommo(
  config: any,
  payload: { leadId: string; note: string; visibility: string }
) {
  try {
    const apiToken = config?.apiToken;
    const accountId = config?.accountId;

    if (!apiToken || !accountId) {
      return { success: false, error: 'Missing Kommo credentials' };
    }

    // Implementação da chamada para Kommo API
    const response = await fetch(`https://api.kommo.com/v2/leads/${payload.leadId}/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: payload.note,
        is_private: payload.visibility === 'private',
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Kommo API error: ${response.statusText}` };
    }

    const data = await response.json();
    return { success: true, noteId: data?.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
