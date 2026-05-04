// src/scripts/diagnose-conversation-filters.ts
import { db } from '@/lib/db';
import { conversations, connections, contacts } from '@/lib/db/schema';
import { eq, sql, isNull, not } from 'drizzle-orm';

async function main() {
    console.log('=== DIAGNÓSTICO DE FILTROS DE CONVERSAS ===\n');

    // 1. Verificar conversas por tipo de conexão
    console.log('📊 Conversas por tipo de conexão:');
    const byType = await db
        .select({
            connectionType: connections.connectionType,
            count: sql<number>`count(*)::int`
        })
        .from(conversations)
        .leftJoin(connections, eq(conversations.connectionId, connections.id))
        .where(not(eq(conversations.status, 'archived')))
        .groupBy(connections.connectionType);

    for (const row of byType) {
        console.log(`  - ${row.connectionType || 'SEM CONEXÃO (null)'}: ${row.count} conversas`);
    }

    // 2. Verificar conversas sem connectionId
    const [orphanCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(isNull(conversations.connectionId));

    console.log(`\n🚨 Conversas ÓRFÃS (sem connectionId): ${orphanCount?.count || 0}`);

    // 3. Listar conexões ativas
    console.log('\n📡 Conexões cadastradas:');
    const allConnections = await db
        .select({
            id: connections.id,
            name: connections.config_name,
            type: connections.connectionType,
            status: connections.status,
            phone: connections.phone
        })
        .from(connections);

    for (const conn of allConnections) {
        console.log(`  - [${conn.type}] ${conn.name} (${conn.phone || 'sem telefone'}) - Status: ${conn.status}`);
    }

    // 4. Verificar se há conversas Baileys
    const baileysConnections = allConnections.filter(c => c.type === 'baileys');
    console.log(`\n🔍 Conexões Baileys encontradas: ${baileysConnections.length}`);

    if (baileysConnections.length > 0) {
        for (const conn of baileysConnections) {
            const [convCount] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(conversations)
                .where(eq(conversations.connectionId, conn.id));

            console.log(`  - ${conn.name}: ${convCount?.count || 0} conversas`);
        }
    }

    // 5. Últimas 5 conversas (para debug)
    console.log('\n📜 Últimas 5 conversas (para diagnóstico):');
    const recentConvs = await db
        .select({
            id: conversations.id,
            contactName: contacts.name,
            connectionName: connections.config_name,
            connectionType: connections.connectionType
        })
        .from(conversations)
        .leftJoin(contacts, eq(conversations.contactId, contacts.id))
        .leftJoin(connections, eq(conversations.connectionId, connections.id))
        .orderBy(sql`${conversations.lastMessageAt} DESC`)
        .limit(5);

    for (const conv of recentConvs) {
        console.log(`  - ${conv.contactName} | Conexão: ${conv.connectionName || 'NENHUMA'} | Tipo: ${conv.connectionType || 'NULL'}`);
    }

    console.log('\n=== FIM DO DIAGNÓSTICO ===');
    process.exit(0);
}

main().catch(console.error);
