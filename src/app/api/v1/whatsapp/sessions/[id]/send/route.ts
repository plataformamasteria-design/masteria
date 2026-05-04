import { NextRequest, NextResponse } from 'next/server';
import { baileysBridge as sessionManager } from '@/lib/baileys-bridge-client';
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

    const sessionResult = await sessionManager.ensureSession(id, companyId);

    if (!sessionResult.success) {
      console.log(`[API] Session ${id} not ready: ${sessionResult.message}`);

      if (sessionResult.status === 'needs_qr') {
        return NextResponse.json(
          {
            error: 'Session requires QR code reconnection',
            status: sessionResult.status,
            message: sessionResult.message
          },
          { status: 409 }
        );
      }

      if (sessionResult.status === 'qr' || sessionResult.status === 'connecting') {
        return NextResponse.json(
          {
            error: 'Session is connecting, please wait...',
            status: sessionResult.status,
            message: sessionResult.message
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: sessionResult.message, status: sessionResult.status },
        { status: 500 }
      );
    }

    const messageId = await sessionManager.sendMessage(id, to, {
      text,
    });

    if (!messageId) {
      return NextResponse.json(
        { error: 'Failed to send message - session not connected' },
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
