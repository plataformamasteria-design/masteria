import { NextRequest, NextResponse } from 'next/server';
import { evolutionApiService } from '@/services/evolution-api.service';
import { db } from '@/lib/db';
import { connections, messages, conversations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const companyId = await getCompanyIdFromSession();

    const body = await request.json();
    const { to, text, conversationId } = body;

    if (!to || !text) {
      return NextResponse.json(
        { error: 'Missing required fields: to, text' },
        { status: 400 }
      );
    }

    const connection = await db.query.connections.findFirst({
      where: and(
        eq(connections.id, id),
        eq(connections.companyId, companyId)
      ),
    });

    if (!connection || connection.connectionType !== 'baileys') {
      return NextResponse.json(
        { error: 'Invalid Baileys session' },
        { status: 404 }
      );
    }

    let statusData: any;
    let isConnected = false;
    try {
        statusData = await evolutionApiService.getConnectionState(id);
        if (statusData?.instance?.state === 'open') {
            isConnected = true;
        }
    } catch (e) {
        console.log(`[API] Session ${id} state error:`, e);
    }

    if (!isConnected) {
      return NextResponse.json(
        {
          error: 'Session is not connected',
          status: statusData?.instance?.state || 'disconnected',
        },
        { status: 409 }
      );
    }

    const { formatJid } = await import('@/lib/utils/whatsapp');
    const phoneJid = formatJid(to);
    const number = phoneJid?.split('@')[0];
    if (!number) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const result = await evolutionApiService.sendMessage(id, number, text);
    const messageId = result?.key?.id;

    if (!messageId) {
      return NextResponse.json(
        { error: 'Failed to send message - error on Evolution API' },
        { status: 500 }
      );
    }

    if (conversationId) {
      const conversation = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.id, conversationId),
          eq(conversations.companyId, companyId),
          eq(conversations.connectionId, id)
        ),
      });

      if (!conversation) {
        return NextResponse.json(
          { error: 'Conversation not found or does not belong to this company/connection' },
          { status: 404 }
        );
      }

      await db.insert(messages).values({
        companyId,
        conversationId,
        providerMessageId: messageId,
        senderType: 'AGENT',
        content: text,
        contentType: 'TEXT',
        status: 'sent',
        sentAt: new Date(),
      });

      await db
        .update(conversations)
        .set({ lastMessageAt: new Date() })
        .where(eq(conversations.id, conversationId));
    }

    return NextResponse.json({
      success: true,
      messageId,
    });
  } catch (error) {
    console.error('[API] Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
