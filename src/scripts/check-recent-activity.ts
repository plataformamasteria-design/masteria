
import { db } from '../lib/db';
import { connections, messages } from '../lib/db/schema';
import { desc } from 'drizzle-orm';

async function checkRecent() {
    try {
        console.log("\n🚀 [CONEXÕES RECENTES]");
        const recentConns = await db.select().from(connections).orderBy(desc(connections.createdAt)).limit(3);
        recentConns.forEach(c => {
            console.log(`   - Nome: ${c.config_name} | Tipo: ${c.connectionType} | Criada em: ${c.createdAt}`);
        });

        console.log("\n💬 [MENSAGENS RECENTES]");
        const recentMsgs = await db.select().from(messages).orderBy(desc(messages.sentAt)).limit(3);
        recentMsgs.forEach(m => {
            console.log(`   - [${m.senderType}] ${m.content.substring(0, 50)}... | Hora: ${m.sentAt}`);
        });
    } catch (e) {
        console.error("Erro no checkRecent:", e);
    }
}

checkRecent();
