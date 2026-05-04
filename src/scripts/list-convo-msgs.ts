
import { db } from '../lib/db';
import { messages, conversations, contacts } from '../lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function listConvo() {
    try {
        const igExtId = '1896097054661185';
        console.log(`🔍 Buscando conversa para IG ID: ${igExtId}`);

        const [contact] = await db.select().from(contacts).where(eq(contacts.externalId, igExtId)).limit(1);
        if (!contact) {
            console.log("❌ Contato não encontrado.");
            return;
        }

        const [convo] = await db.select().from(conversations).where(eq(conversations.contactId, contact.id)).limit(1);
        if (!convo) {
            console.log("❌ Conversa não encontrada.");
            return;
        }

        console.log(`✅ Lendo mensagens da conversa ${convo.id}...`);
        const msgs = await db.select().from(messages).where(eq(messages.conversationId, convo.id)).orderBy(desc(messages.sentAt)).limit(20);

        msgs.forEach(m => {
            console.log(`   - [${m.sentAt.toLocaleTimeString()}] [${m.senderType}] Status: ${m.status} | ID: ${m.id} | ProvID: ${m.providerMessageId?.substring(0, 30)}... | Content: ${m.content.substring(0, 30)}`);
        });

    } catch (e) {
        console.error("Erro:", e);
    }
}

listConvo();
