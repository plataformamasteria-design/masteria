// src/scripts/diagnose-baileys-messages.ts
import { db } from '@/lib/db';
import { conversations, connections, contacts, messages } from '@/lib/db/schema';
import { eq, sql, desc, and } from 'drizzle-orm';

async function main() {
    console.log('=== DIAGNÓSTICO DE MENSAGENS BAILEYS ===\n');

    // 1. Listar conexões Baileys
    const baileysConnections = await db
        .select({
            id: connections.id,
            name: connections.config_name,
            phone: connections.phone,
            status: connections.status,
        })
        .from(connections)
        .where(eq(connections.connectionType, 'baileys'));

    console.log(`📡 Conexões Baileys encontradas: ${baileysConnections.length}\n`);

    for (const conn of baileysConnections) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔌 Conexão: ${conn.name} (${conn.phone || 'sem telefone'})`);
        console.log(`   Status: ${conn.status}`);
        console.log(`${'='.repeat(80)}\n`);

        // 2. Contar conversas desta conexão
        const [convCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(conversations)
            .where(eq(conversations.connectionId, conn.id));

        console.log(`💬 Total de conversas: ${convCount?.count || 0}`);

        // 3. Analisar mensagens por senderType
        const messageCounts = await db
            .select({
                senderType: messages.senderType,
                count: sql<number>`count(*)::int`
            })
            .from(messages)
            .innerJoin(conversations, eq(messages.conversationId, conversations.id))
            .where(eq(conversations.connectionId, conn.id))
            .groupBy(messages.senderType);

        console.log('\n📊 Mensagens por tipo de remetente:');
        for (const row of messageCounts) {
            console.log(`   - ${row.senderType}: ${row.count} mensagens`);
        }

        // 4. Verificar status das mensagens
        const statusCounts = await db
            .select({
                status: messages.status,
                count: sql<number>`count(*)::int`
            })
            .from(messages)
            .innerJoin(conversations, eq(messages.conversationId, conversations.id))
            .where(eq(conversations.connectionId, conn.id))
            .groupBy(messages.status);

        console.log('\n📈 Mensagens por status:');
        for (const row of statusCounts) {
            console.log(`   - ${row.status || 'NULL'}: ${row.count} mensagens`);
        }

        // 5. Últimas 10 mensagens desta conexão
        console.log('\n📜 Últimas 10 mensagens:');
        const recentMessages = await db
            .select({
                messageId: messages.id,
                contactName: contacts.name,
                senderType: messages.senderType,
                content: messages.content,
                status: messages.status,
                sentAt: messages.sentAt,
                providerMessageId: messages.providerMessageId
            })
            .from(messages)
            .innerJoin(conversations, eq(messages.conversationId, conversations.id))
            .leftJoin(contacts, eq(conversations.contactId, contacts.id))
            .where(eq(conversations.connectionId, conn.id))
            .orderBy(desc(messages.sentAt))
            .limit(10);

        for (const msg of recentMessages) {
            const preview = (msg.content || '').substring(0, 50);
            const timestamp = new Date(msg.sentAt).toLocaleString('pt-BR');
            console.log(`\n   ${msg.senderType === 'AGENT' ? '→' : '←'} [${msg.senderType}] ${msg.contactName}`);
            console.log(`     ${timestamp} | Status: ${msg.status || 'N/A'}`);
            console.log(`     "${preview}${preview.length >= 50 ? '...' : ''}"`);
            console.log(`     Provider ID: ${msg.providerMessageId || 'N/A'}`);
        }

        // 6. Verificar mensagens enviadas (fromMe)
        const [agentMsgCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(messages)
            .innerJoin(conversations, eq(messages.conversationId, conversations.id))
            .where(and(
                eq(conversations.connectionId, conn.id),
                eq(messages.senderType, 'AGENT')
            ));

        console.log(`\n\n🤖 Mensagens do Agente (fromMe): ${agentMsgCount?.count || 0}`);

        // 7. Verificar se há mensagens com senderId null (que são de agentes)
        const [agentNullSenderCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(messages)
            .innerJoin(conversations, eq(messages.conversationId, conversations.id))
            .where(and(
                eq(conversations.connectionId, conn.id),
                eq(messages.senderType, 'AGENT'),
                sql`${messages.senderId} IS NULL`
            ));

        console.log(`   - Com senderId NULL: ${agentNullSenderCount?.count || 0}`);
    }

    console.log('\n\n=== FIM DO DIAGNÓSTICO ===');
    process.exit(0);
}

main().catch(console.error);
