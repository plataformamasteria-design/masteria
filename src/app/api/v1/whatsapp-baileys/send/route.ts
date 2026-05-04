import { NextResponse, type NextRequest } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { baileysBridge as sessionManager } from '@/lib/baileys-bridge-client';
import { z } from 'zod';

const sendMessageSchema = z.object({
  connectionId: z.string().uuid('ID de conexão inválido'),
  to: z.string().min(10, 'Número do destinatário deve ter pelo menos 10 dígitos'),
  message: z.string().min(1, 'Mensagem não pode estar vazia'),
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    const body = await request.json();

    const parsed = sendMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const { connectionId, to, message } = parsed.data;

    const [connection] = await db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.id, connectionId),
          eq(connections.companyId, companyId),
          eq(connections.connectionType, 'baileys')
        )
      );

    if (!connection) {
      return NextResponse.json(
        { error: 'Conexão Baileys não encontrada ou não pertence à sua empresa' },
        { status: 404 }
      );
    }

    if (!connection.isActive || connection.status !== 'connected') {
      return NextResponse.json(
        {
          error: 'Conexão não está ativa ou conectada',
          status: connection.status
        },
        { status: 400 }
      );
    }

    console.log(`[Baileys API] Sending message via connection ${connectionId} to ${to}`);

    const availability = sessionManager.checkAvailability(connectionId, companyId);

    if (!availability.available) {
      console.error(`[Baileys API] Connection not available:`, availability);
      return NextResponse.json(
        {
          error: 'Sessão Baileys não disponível',
          details: availability.details,
          status: availability.status
        },
        { status: 503 }
      );
    }

    const messageId = await sessionManager.sendMessage(connectionId, to, {
      text: message,
    });

    if (!messageId) {
      console.error(`[Baileys API] Failed to send message - no ID returned`);
      return NextResponse.json(
        { error: 'Falha ao enviar mensagem. Verifique os logs do servidor.' },
        { status: 500 }
      );
    }

    console.log(`[Baileys API] Message sent successfully: ${messageId}`);

    return NextResponse.json({
      success: true,
      messageId,
      message: 'Mensagem enviada com sucesso',
      details: {
        connectionId,
        to,
        providerMessageId: messageId,
      },
    });
  } catch (error) {
    console.error('[Baileys API] Error sending message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
