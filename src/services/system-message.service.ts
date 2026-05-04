// src/services/system-message.service.ts
import { db } from '@/lib/db';
import { messages, conversations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Insere uma mensagem do tipo SYSTEM no chat de uma conversa.
 * Estas mensagens são visíveis no chat como notificações de ações do sistema.
 */
export async function createSystemMessage(params: {
  conversationId: string;
  companyId: string;
  content: string;
}): Promise<void> {
  try {
    await db.insert(messages).values({
      conversationId: params.conversationId,
      companyId: params.companyId,
      content: params.content,
      contentType: 'TEXT',
      senderType: 'SYSTEM',
      status: 'delivered',
      sentAt: new Date(),
    });

    // Atualizar lastMessageAt para que a conversa suba na lista
    await db.update(conversations)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(conversations.id, params.conversationId));
  } catch (error) {
    // Falha silenciosa — system messages não devem quebrar o fluxo principal
    console.error('[SystemMessage] Failed to create system message:', error);
  }
}
