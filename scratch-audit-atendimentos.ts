import { db } from './src/lib/db';
import { connections, conversations, messages, contacts } from './src/lib/db/schema';
import { eq, isNull, sql } from 'drizzle-orm';

async function auditAtendimentos() {
    console.log('--- AUDITANDO INTEGRIDADE DE ATENDIMENTOS E CONEXÕES ---\n');

    try {
        // 1. Mensagens órfãs (sem conversa associada)
        const orphanMessages = await db.select({ count: sql`count(*)` }).from(messages).where(isNull(messages.conversationId));
        console.log(`Mensagens órfãs (sem conversa): ${orphanMessages[0].count}`);

        // 2. Conversas órfãs (sem contato associado)
        const orphanConversations = await db.select({ count: sql`count(*)` }).from(conversations).where(isNull(conversations.contactId));
        console.log(`Conversas órfãs (sem contato): ${orphanConversations[0].count}`);

        // 3. Conversas ligadas a conexões inexistentes
        const invalidConnectionConversations = await db.execute(sql`
            SELECT count(*) as count 
            FROM conversations c 
            LEFT JOIN connections conn ON c.connection_id = conn.id 
            WHERE conn.id IS NULL AND c.connection_id IS NOT NULL
        `);
        console.log(`Conversas em conexões deletadas/inexistentes: ${invalidConnectionConversations[0]?.count || 0}`);

        // 4. Contatos duplicados (mesmo telefone, mesma empresa)
        const duplicateContacts = await db.execute(sql`
            SELECT company_id, phone, count(*) as count 
            FROM contacts 
            WHERE phone IS NOT NULL AND phone != '' 
            GROUP BY company_id, phone 
            HAVING count(*) > 1
        `);
        console.log(`Contatos duplicados (mesmo telefone): ${duplicateContacts.length} grupos encontrados`);
        if (duplicateContacts.length > 0) {
            console.log('  Exemplo de duplicados:', duplicateContacts.slice(0, 3));
        }

        // 5. Verificar status de webhook
        const failedWebhooks = await db.select({ id: connections.id, name: connections.config_name, status: connections.webhookStatus })
            .from(connections)
            .where(eq(connections.webhookStatus, 'error'));
        console.log(`\nConexões com falha de webhook marcadas no DB: ${failedWebhooks.length}`);

        console.log('\n--- FIM DA AUDITORIA ---');
    } catch (error) {
        console.error('Erro ao auditar:', error);
    }
}

auditAtendimentos();
