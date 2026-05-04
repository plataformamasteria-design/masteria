
import { db } from '../lib/db';
import { messages, conversations } from '../lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function checkMessages() {
    const contactId = "b9afd18e-3333-4d81-b028-ff538a63393b";
    try {
        console.log(`🔍 Buscando mensagens para o contato ${contactId}...`);

        const [convo] = await db.select().from(conversations).where(eq(conversations.contactId, contactId)).limit(1);

        if (!convo) {
            console.log("❌ Nenhuma conversa encontrada.");
            return;
        }

        const msgList = await db.select().from(messages)
            .where(eq(messages.conversationId, convo.id))
            .orderBy(desc(messages.sentAt))
            .limit(5);

        console.log(`✅ Mensagens encontradas (${msgList.length}):`);
        msgList.forEach(m => {
            console.log(`   - Data: ${m.sentAt} | Content: ${m.content?.substring(0, 30)} | Sender: ${m.senderType}`);
        });

    } catch (e) {
        console.error("Erro na busca:", e);
    }
}

checkMessages();
