
import { db } from '../src/lib/db';
import { messages } from '../src/lib/db/schema';
import { desc, gt } from 'drizzle-orm';

async function checkRecentMessages() {
    console.log('🔍 Buscando mensagens recentes (últimos 15 min)...');
    try {
        const recent = await db.select()
            .from(messages)
            .where(gt(messages.sentAt, new Date(Date.now() - 15 * 60 * 1000)))
            .orderBy(desc(messages.sentAt))
            .limit(10);

        if (recent.length === 0) {
            console.log('❌ Nenhuma mensagem encontrada nos últimos 15 minutos.');
        } else {
            console.log(`✅ ${recent.length} mensagens encontradas:`);
            recent.forEach(m => {
                console.log(`--------------------------------------------------`);
                console.log(`ID: ${m.id}`);
                console.log(`Time: [${m.sentAt?.toLocaleTimeString()}]`);
                console.log(`Sender: ${m.senderType}`);
                console.log(`Type: ${m.contentType}`);
                console.log(`Content: ${m.content?.substring(0, 50)}...`);
                console.log(`Status: ${m.status}`);
                console.log(`ProviderMsgId: ${m.providerMessageId || 'NULL'}`);
                if (m.mediaUrl) console.log(`MediaURL: ${m.mediaUrl}`);
            });
        }
    } catch (e) {
        console.error('Erro:', e);
    }
    process.exit(0);
}

checkRecentMessages();
