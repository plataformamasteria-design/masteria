// Script para ver histórico de mensagens de contatos específicos
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    const conversationIds = [
        'cbd15b14-8b32-46c0-896a-740b438541aa', // Marines
        '3ae4ee27-755a-44ee-90f6-25e236d87c4c', // Dina Estetica
        'eadac5eb-1f93-4e18-94a1-7e845634c22b'  // são caetano
    ];

    for (const convId of conversationIds) {
        console.log('\n' + '═'.repeat(70));

        // Info da conversa
        const convInfo = await db.execute(sql`
            SELECT ct.name, ct.phone, c.ai_active, conn.config_name, c.assigned_persona_id
            FROM conversations c
            LEFT JOIN contacts ct ON ct.id = c.contact_id
            LEFT JOIN connections conn ON conn.id = c.connection_id
            WHERE c.id = ${convId}
        `);
        const conv = Array.isArray(convInfo) ? convInfo[0] : (convInfo as any)?.rows?.[0];

        console.log(`📞 ${conv?.name} (${conv?.phone})`);
        console.log(`   Conexão: ${conv?.config_name}`);
        console.log(`   aiActive: ${conv?.ai_active}`);
        console.log(`   Persona ID: ${conv?.assigned_persona_id || 'null'}`);
        console.log('\n📜 Últimas 10 mensagens (ordem cronológica):');
        console.log('─'.repeat(70));

        // Histórico de mensagens
        const msgs = await db.execute(sql`
            SELECT sender_type, content, sent_at, is_ai_generated
            FROM messages
            WHERE conversation_id = ${convId}
            ORDER BY sent_at DESC
            LIMIT 10
        `);
        const messages = Array.isArray(msgs) ? msgs : (msgs as any)?.rows || [];

        // Inverter para ordem cronológica
        for (const m of messages.reverse()) {
            const indicator = m.sender_type === 'CONTACT' ? '👤 CONTATO' :
                m.sender_type === 'AI' ? '🤖 IA' :
                    m.sender_type === 'USER' ? '👨‍💼 ATENDENTE' : '📢 SISTEMA';
            const aiFlag = m.is_ai_generated ? ' [gerado por IA]' : '';
            console.log(`\n${indicator}${aiFlag} @ ${m.sent_at}`);
            console.log(`   ${(m.content || '').substring(0, 100)}${m.content?.length > 100 ? '...' : ''}`);
        }
    }

    process.exit(0);
}

main().catch(console.error);
