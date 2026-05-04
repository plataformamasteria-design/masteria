
import { db } from '../lib/db';
import { messages } from '../lib/db/schema';
import { desc, gte } from 'drizzle-orm';

async function checkTodayMessages() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        console.log(`🔍 Verificando mensagens de hoje (${today.toLocaleDateString()})...`);
        const todayMsgs = await db.select().from(messages)
            .where(gte(messages.sentAt, today))
            .orderBy(desc(messages.sentAt));

        console.log(`✅ Encontradas ${todayMsgs.length} mensagens hoje.`);
        todayMsgs.forEach(m => {
            console.log(`   - [${m.sentAt.toLocaleTimeString()}] [${m.senderType}] Status: ${m.status || 'NULO'} | Conteúdo: ${m.content.substring(0, 40)}... | ID: ${m.id}`);
        });
    } catch (e) {
        console.error("Erro na verificação:", e);
    }
}

checkTodayMessages();
