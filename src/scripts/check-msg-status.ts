
import { db } from '../lib/db';
import { messages } from '../lib/db/schema';
import { desc } from 'drizzle-orm';

async function checkMessageStatus() {
    try {
        console.log("🔍 Verificando os status das últimas 10 mensagens...");
        const recentMessages = await db.select().from(messages).orderBy(desc(messages.sentAt)).limit(10);

        recentMessages.forEach(m => {
            console.log(`   - ID: ${m.id} | Status: ${m.status || 'NULO'} | Content: ${m.content.substring(0, 30)}... | SentAt: ${m.sentAt} | ProviderMsgID: ${m.providerMessageId || 'NULO'}`);
        });
    } catch (e) {
        console.error("Erro na verificação:", e);
    }
}

checkMessageStatus();
