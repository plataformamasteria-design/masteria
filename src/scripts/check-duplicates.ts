
import { db } from '../lib/db';
import { messages } from '../lib/db/schema';
import { ilike } from 'drizzle-orm';

async function checkDuplicates() {
    try {
        console.log("🔍 Procurando duplicatas de 'teste de vdd???'...");
        const msgs = await db.select().from(messages).where(ilike(messages.content, '%teste de vdd%'));

        console.log(`✅ Encontradas ${msgs.length} mensagens:`);
        msgs.forEach(m => {
            console.log(`   - ID: ${m.id} | Status: ${m.status} | Type: ${m.senderType} | ProvID: ${m.providerMessageId}`);
        });

        console.log("\n🔍 Procurando duplicatas de 'ok testado'...");
        const msgs2 = await db.select().from(messages).where(ilike(messages.content, '%ok testado%'));
        msgs2.forEach(m => {
            console.log(`   - ID: ${m.id} | Status: ${m.status} | Type: ${m.senderType} | ProvID: ${m.providerMessageId}`);
        });

    } catch (e) {
        console.error("Erro na busca:", e);
    }
}

checkDuplicates();
