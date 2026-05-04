
import { db } from '../src/lib/db';
import { messages, connections, contacts, conversations } from '../src/lib/db/schema';
import { desc, eq, and, isNotNull } from 'drizzle-orm';
import { sendUnifiedMessage } from '../src/services/unified-message-sender.service';

async function main() {
    console.log('🔍 Buscando última mensagem de áudio enviada pela IA...');

    const lastAudioMsg = await db.select()
        .from(messages)
        .where(and(
            eq(messages.senderType, 'AI'),
            eq(messages.contentType, 'AUDIO'),
            isNotNull(messages.mediaUrl)
        ))
        .orderBy(desc(messages.sentAt))
        .limit(1);

    if (!lastAudioMsg.length) {
        console.log('❌ Nenhuma mensagem de áudio encontrada.');
        process.exit(1);
    }

    const msg = lastAudioMsg[0];
    console.log(`✅ Mensagem encontrada: ID=${msg.id}`);
    console.log(`   URL: ${msg.mediaUrl}`);
    console.log(`   Data: ${msg.sentAt}`);
    console.log(`   ConversationId: ${msg.conversationId}`);

    // Buscar contato e conexão
    const contact = await db.query.contacts.findFirst({
        where: eq(contacts.id, msg.senderId || '') // AI senderId might be 'ai_agent_voice', need to find recipient
    });
    
    // Actually, msg.senderId is 'ai_agent_voice', we need the conversation's contact
    const conversation = await db.query.conversations.findFirst({
        where: eq(conversations.id, msg.conversationId!),
        with: {
            contact: true,
            connection: true
        }
    });

    if (!conversation || !conversation.contact || !conversation.connection) {
        console.log('❌ Conversa, contato ou conexão não encontrados.');
        process.exit(1);
    }

    const targetPhone = conversation.contact.phone;
    const connectionId = conversation.connection.id;
    const provider = conversation.connection.connectionType === 'baileys' ? 'baileys' : 'apicloud';

    console.log(`🚀 Tentando reenviar áudio para: ${targetPhone} via ${provider} (${connectionId})`);
    console.log(`   MediaURL: ${msg.mediaUrl}`);

    const result = await sendUnifiedMessage({
        provider,
        connectionId,
        to: targetPhone,
        message: '', 
        mediaUrl: msg.mediaUrl!,
        mediaType: 'audio'
    });

    if (result.success) {
        console.log(`✅ Áudio reenviado com sucesso! MessageID: ${result.messageId}`);
    } else {
        console.error(`❌ Falha ao reenviar áudio: ${result.error}`);
    }

    process.exit(0);
}

main().catch(console.error);
