// Script para buscar contatos específicos
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🔍 Buscando contatos específicos...\n');

    const searchTerms = ['Marines', 'Dina', 'caetano'];

    for (const term of searchTerms) {
        const rows = await db.execute(sql`
            SELECT 
                c.id as conversation_id,
                ct.name as contact_name,
                ct.phone as contact_phone,
                c.ai_active,
                c.last_message_at,
                conn.config_name as connection_name,
                (SELECT m.sender_type FROM messages m WHERE m.conversation_id = c.id ORDER BY m.sent_at DESC LIMIT 1) as last_sender,
                (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.sent_at DESC LIMIT 1) as last_content
            FROM conversations c
            LEFT JOIN contacts ct ON ct.id = c.contact_id
            LEFT JOIN connections conn ON conn.id = c.connection_id
            WHERE LOWER(ct.name) LIKE ${`%${term.toLowerCase()}%`}
            ORDER BY c.last_message_at DESC
            LIMIT 10
        `);

        const data = Array.isArray(rows) ? rows : (rows as any)?.rows || [];

        if (data.length > 0) {
            console.log(`\n${'═'.repeat(60)}`);
            console.log(`🔎 Resultados para: "${term}" (${data.length} encontrados)`);
            console.log('═'.repeat(60));

            for (const r of data) {
                const needsResponse = r.last_sender === 'CONTACT';
                console.log(`\n📞 ${r.contact_name} (${r.contact_phone})`);
                console.log(`   Conexão: ${r.connection_name || 'null'}`);
                console.log(`   aiActive: ${r.ai_active ? '✅' : '❌'}`);
                console.log(`   Última msg: ${r.last_message_at}`);
                console.log(`   Último remetente: ${r.last_sender}`);
                console.log(`   ⚠️ Precisa resposta: ${needsResponse ? '🔴 SIM' : '🟢 NÃO'}`);
                console.log(`   Conteúdo: ${(r.last_content as string || '').substring(0, 80)}...`);
                console.log(`   ID: ${r.conversation_id}`);
            }
        } else {
            console.log(`\n⚠️ Nenhum resultado para: "${term}"`);
        }
    }

    process.exit(0);
}

main().catch(console.error);
