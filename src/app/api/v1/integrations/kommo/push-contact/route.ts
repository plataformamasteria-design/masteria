// src/app/api/v1/integrations/kommo/push-contact/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { contacts, crmIntegrations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

const contactSchema = z.object({
  contactId: z.string().min(1, 'Contact ID is required'),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
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
    const validation = contactSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { contactId, name, phone, email } = validation.data;

    // 1. Buscar contato no banco
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.companyId, companyId)))
      .limit(1);

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
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

    // 3. Preparar dados para Kommo
    const kommoPayload = {
      name: name || contact.name,
      phone: phone || contact.phone,
      email: email || contact.email,
      externalId: contact.externalId,
    };

    // 4. Chamar API Kommo (mock para desenvolvimento)
    const kommoResponse = await pushContactToKommo(
      (kommoIntegration as any).config || {},
      kommoPayload
    );

    if (!kommoResponse.success) {
      return NextResponse.json(
        { error: 'Failed to push contact to Kommo', details: kommoResponse.error },
        { status: 500 }
      );
    }

    // 5. Atualizar externalId se novo
    if (!contact.externalId && kommoResponse.contactId) {
      await db
        .update(contacts)
        .set({ externalId: kommoResponse.contactId })
        .where(eq(contacts.id, contactId));
    }

    console.log('[Kommo] Contact pushed successfully:', {
      contactId,
      kommoId: kommoResponse.contactId,
    });

    return NextResponse.json({
      success: true,
      message: 'Contact pushed to Kommo successfully',
      kommoId: kommoResponse.contactId,
    });
  } catch (error) {
    console.error('[Kommo] Error pushing contact:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper function to push contact to Kommo API
async function pushContactToKommo(config: any, payload: any) {
  try {
    const apiToken = config?.apiToken;
    const accountId = config?.accountId;

    if (!apiToken || !accountId) {
      return { success: false, error: 'Missing Kommo credentials' };
    }

    // Implementação da chamada para Kommo API
    const response = await fetch('https://api.kommo.com/v2/contacts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        custom_fields_values: {
          external_id: payload.externalId,
        },
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Kommo API error: ${response.statusText}` };
    }

    const data = await response.json();
    return { success: true, contactId: data?.id || payload.externalId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
