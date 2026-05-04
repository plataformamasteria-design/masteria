
import { db } from '../lib/db';
import { messages, connections } from '../lib/db/schema';
import { desc, eq, or } from 'drizzle-orm';

async function watchActivity() {
    console.log("🕵️‍♂️ Monitorando Atividade de Mensagens e Conexões...");
    let lastMsgId = '';

    const running = true;
    while (running) {
        try {
            // 1. Check for New Connections
            const conns = await db.select().from(connections).where(or(eq(connections.connectionType, 'meta_api'), eq(connections.connectionType, 'instagram')));
            if (conns.length > 0) {
                console.log(`\n🔌 Conexões Ativas [${new Date().toLocaleTimeString()}]:`);
                conns.forEach(c => console.log(`   - ${c.connectionType}: ${c.config_name} (ID: ${c.phoneNumberId || 'NULO'})`));
            }

            // 2. Check for New Messages
            const [latestMsg] = await db.select().from(messages).orderBy(desc(messages.sentAt)).limit(1);
            if (latestMsg && latestMsg.id !== lastMsgId) {
                if (lastMsgId !== '') { // Don't log the baseline
                    console.log(`\n📧 NOVA MENSAGEM DETECTADA:`);
                    console.log(`   - Conteúdo: ${latestMsg.content.substring(0, 100)}`);
                    console.log(`   - Tipo: ${latestMsg.senderType} | Hora: ${latestMsg.sentAt}`);
                }
                lastMsgId = latestMsg.id;
            }

            await new Promise(r => setTimeout(r, 5000));
        } catch (e) {
            console.error("Erro no monitor:", e);
            await new Promise(r => setTimeout(r, 10000));
        }
    }
}

watchActivity();
