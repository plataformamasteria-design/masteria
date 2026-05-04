
import { db } from '@/lib/db';
import { messages, automationLogs, systemErrors } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

async function monitorFlow() {
    try {
        console.log("=== 🔍 MONITORAMENTO DE FLUXO ===\n");
        
        console.log("📨 Últimas 5 Mensagens:");
        const msgs = await db.select().from(messages).orderBy(desc(messages.sentAt)).limit(5);
        msgs.forEach(m => {
            const iso = m.sentAt?.toISOString();
            const time = iso ? (iso.split('T')[1]?.split('.')[0] ?? 'N/A') : 'N/A';
            const content = m.content ? m.content.substring(0, 50) : 'No content';
            console.log(`[${time}] [${m.senderType}] ${content}... (ID: ${m.id})`);
        });

        console.log("\n🤖 Últimos 5 Logs de Automação:");
        const logs = await db.select().from(automationLogs).orderBy(desc(automationLogs.createdAt)).limit(5);
        logs.forEach(l => {
            const message = l.message ? l.message.substring(0, 100) : 'No message';
            const iso = l.createdAt?.toISOString();
            const time = iso ? (iso.split('T')[1]?.split('.')[0] ?? 'N/A') : 'N/A';
            console.log(`[${time}] [${l.level}] ${message}...`);
        });


        console.log("\n❌ Últimos 3 Erros do Sistema:");
        const errors = await db.select().from(systemErrors).orderBy(desc(systemErrors.createdAt)).limit(3) as any[];
        if (errors.length === 0) console.log("Nenhum erro recente.");
        for (const err of errors) {
            if (!err) continue;
            const row = err as typeof systemErrors.$inferSelect;
            const message = row.message ? row.message.substring(0, 100) : 'No message';
            const createdAt = row.createdAt;
            const iso = createdAt?.toISOString();
            const time = iso ? (iso.split('T')[1]?.split('.')[0] ?? 'N/A') : 'N/A';
            const severity = row.severity ?? 'UNKNOWN';
            console.log(`[${time}] [${severity}] ${message}...`);
        }

        console.log("\n🧪 Testando escrita de log...");
        const firstMsg = msgs[0];
        if (firstMsg?.companyId) {
            try {
                await db.insert(automationLogs).values({
                    companyId: firstMsg.companyId,
                    level: 'INFO',
                    message: 'Teste de monitoramento - Verificação de escrita',
                    createdAt: new Date()
                });
                console.log("✅ Log de teste escrito com sucesso.");
            } catch (e) {
                console.error("❌ Falha ao escrever log de teste:", e);
            }
        } else {
            console.log("⚠️ Não foi possível obter companyId para teste.");
        }

    } catch (e) {
        console.error("Erro no monitoramento:", e);
    } finally {
        process.exit(0);
    }
}

monitorFlow();
