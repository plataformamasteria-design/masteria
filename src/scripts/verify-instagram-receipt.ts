import 'dotenv/config'; // Validation: Must be first
import { db } from "@/lib/db";
import { messages, conversations, metaWebhookHealthEvents, connections, webhookLogs } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

async function verifyInstagramReceipt() {
    console.log("\n🕵️  VERIFICANDO RECEBIMENTO DE MENSAGENS NO BANCO DE DADOS...\n");

    try {
        // 1. Check Active Instagram Connection
        const igConnections = await db.select({
            id: connections.id,
            name: connections.config_name,
            phoneNumberId: connections.phoneNumberId,
            status: connections.status
        })
            .from(connections)
            .where(eq(connections.connectionType, 'instagram'));

        console.log("📡 Conexões do Instagram:");
        if (igConnections.length === 0) {
            console.log("   ❌ Nenhuma conexão do tipo 'instagram' encontrada.");
        } else {
            igConnections.forEach(c => console.log(`   ✅ [${c.status}] ${c.name} (ID: ${c.phoneNumberId})`));
        }

        // 2. Check Recent Messages (Last 5)
        console.log("\n📨 Úitimas 5 Mensagens Recebidas (Qualquer Canal):");
        const recentMessages = await db.select({
            id: messages.id,
            content: messages.content,
            sentAt: messages.sentAt,
            senderType: messages.senderType,
            conversationId: conversations.id,
            source: conversations.source,
        })
            .from(messages)
            .innerJoin(conversations, eq(messages.conversationId, conversations.id))
            .orderBy(desc(messages.sentAt))
            .limit(5);

        if (recentMessages.length === 0) {
            console.log("   ⚠️ Nenhuma mensagem encontrada no banco.");
        } else {
            recentMessages.forEach(m => {
                console.log(`   [${m.sentAt?.toLocaleString()}] ${m.senderType} (${m.source}): "${m.content?.substring(0, 50)}..."`);
            });
        }

        // 3. Check Webhook Health Events
        console.log("\n💓 Eventos de Saúde do Webhook (Últimos 5):");
        const healthEvents = await db.select()
            .from(metaWebhookHealthEvents)
            .orderBy(desc(metaWebhookHealthEvents.validatedAt))
            .limit(5);

        if (healthEvents.length === 0) {
            console.log("   ℹ️ Nenhum evento de webhook registrado.");
        } else {
            healthEvents.forEach(h => {
                console.log(`   [${h.validatedAt?.toLocaleString()}] Status: ${h.status} | Erro: ${h.errorMessage || 'Nenhum'}`);
            });
        }

        // 4. Check Raw Webhook Logs (Last 20)
        console.log("\n📦 Logs Brutos do Webhook (webhook_logs - Últimos 20):");
        const rawLogs = await db.select()
            .from(webhookLogs)
            .orderBy(desc(webhookLogs.createdAt))
            .limit(20);

        const input = rawLogs;
        const types = input.reduce((acc: any, l) => {
            const t = (l.payload as any).object || 'unknown';
            acc[t] = (acc[t] || 0) + 1;
            return acc;
        }, {});
        console.log("\n   📊 DISTRIBUIÇÃO DE TIPOS NOS ÚLTIMOS 20 LOGS:");
        console.log("   ", JSON.stringify(types, null, 2));

        const instaLogs = rawLogs.filter(l => (l.payload as any).object === 'instagram' || (l.payload as any).object === 'page');
        // Also check for 'page' as sometimes IG comes as Page? (Usually not, but good to check).

        if (instaLogs.length > 0) {
            instaLogs.forEach(l => {
                console.log(`   [${l.createdAt?.toLocaleString()}] IG Event`);
                console.log(`   DATA: ${JSON.stringify(l.payload)}`);
            });
        } else {
            console.log("   ❌ NENHUM evento de Instagram encontrado nos últimos 20 logs. O Webhook pode estar mal configurado ou não recebendo eventos.");
        }

    } catch (error) {
        console.error("\n❌ ERRO FATAL AO CONSULTAR BANCO:", error);
        console.log("   Verifique se a variável DATABASE_URL está definida corretamente.");
    } finally {
        process.exit(0);
    }
}

verifyInstagramReceipt();
