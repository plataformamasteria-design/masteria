// src/scripts/backfill-company-id.ts
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🚀 Iniciando backfill de companyId para Absolute Multi-Tenancy (com guards de integridade)...');

    try {
        // 1. Messages (via conversations)
        console.log('📦 Processando mensagens...');
        await db.execute(sql`
            UPDATE messages m
            SET company_id = c.company_id
            FROM conversations c
            WHERE m.conversation_id = c.id
            AND m.company_id IS NULL
            AND EXISTS (SELECT 1 FROM companies WHERE id = c.company_id);
        `);
        console.log(`✅ Mensagens atualizadas.`);

        // 2. Kanban Leads (via kanban boards)
        console.log('🏷️ Processando kanban_leads...');
        await db.execute(sql`
            UPDATE kanban_leads l
            SET company_id = b.company_id
            FROM kanban_boards b
            WHERE l.board_id = b.id
            AND l.company_id IS NULL
            AND EXISTS (SELECT 1 FROM companies WHERE id = b.company_id);
        `);
        console.log(`✅ Kanban leads atualizados.`);

        // 3. Message Reactions (via messages)
        console.log('😁 Processando reações de mensagens...');
        await db.execute(sql`
            UPDATE message_reactions r
            SET company_id = m.company_id
            FROM messages m
            WHERE r.message_id = m.id
            AND r.company_id IS NULL
            AND EXISTS (SELECT 1 FROM companies WHERE id = m.company_id);
        `);
        console.log(`✅ Reações de mensagens atualizadas.`);

        // 4. AI Chat Messages (via ai_chats)
        console.log('🤖 Processando mensagens de chat IA...');
        await db.execute(sql`
            UPDATE ai_chat_messages m
            SET company_id = c.company_id
            FROM ai_chats c
            WHERE m.chat_id = c.id
            AND m.company_id IS NULL
            AND EXISTS (SELECT 1 FROM companies WHERE id = c.company_id);
        `);
        console.log(`✅ Mensagens de chat IA atualizadas.`);

        // 5. WhatsApp Delivery Reports (via campaigns)
        console.log('📱 Processando relatórios de entrega WhatsApp...');
        await db.execute(sql`
            UPDATE whatsapp_delivery_reports r
            SET company_id = c.company_id
            FROM campaigns c
            WHERE r.campaign_id = c.id
            AND r.company_id IS NULL
            AND EXISTS (SELECT 1 FROM companies WHERE id = c.company_id);
        `);
        console.log(`✅ Relatórios WhatsApp atualizados.`);

        // 6. SMS Delivery Reports (via campaigns)
        console.log('✉️ Processando relatórios de entrega SMS...');
        await db.execute(sql`
             UPDATE sms_delivery_reports r
             SET company_id = c.company_id
             FROM campaigns c
             WHERE r.campaign_id = c.id
             AND r.company_id IS NULL
             AND EXISTS (SELECT 1 FROM companies WHERE id = c.company_id);
         `);
        console.log(`✅ Relatórios SMS atualizados.`);

        // 7. Voice Delivery Reports (via campaigns)
        console.log('📞 Processando relatórios de entrega Voz...');
        await db.execute(sql`
             UPDATE voice_delivery_reports r
             SET company_id = c.company_id
             FROM campaigns c
             WHERE r.campaign_id = c.id
             AND r.company_id IS NULL
             AND EXISTS (SELECT 1 FROM companies WHERE id = c.company_id);
         `);
        console.log(`✅ Relatórios Voz atualizados.`);

        // 8. Baileys Auth State (via connections)
        console.log('🔑 Processando Baileys Auth State...');
        await db.execute(sql`
             UPDATE baileys_auth_state s
             SET company_id = c.company_id
             FROM connections c
             WHERE s.connection_id = c.id
             AND s.company_id IS NULL
             AND EXISTS (SELECT 1 FROM companies WHERE id = c.company_id);
         `);
        console.log(`✅ Baileys Auth State atualizado.`);

        // 9. Contacts to Tags (via contacts)
        console.log('🔗 Processando contatos <-> tags...');
        await db.execute(sql`
             UPDATE contacts_to_tags ctt
             SET company_id = c.company_id
             FROM contacts c
             WHERE ctt.contact_id = c.id
             AND ctt.company_id IS NULL
             AND EXISTS (SELECT 1 FROM companies WHERE id = c.company_id);
         `);
        console.log(`✅ Relacionamentos de tags atualizados.`);

        // 10. Contacts to Lists (via contacts)
        console.log('🔗 Processando contatos <-> listas...');
        await db.execute(sql`
             UPDATE contacts_to_contact_lists ctcl
             SET company_id = c.company_id
             FROM contacts c
             WHERE ctcl.contact_id = c.id
             AND ctcl.company_id IS NULL
             AND EXISTS (SELECT 1 FROM companies WHERE id = c.company_id);
         `);
        console.log(`✅ Relacionamentos de listas atualizados.`);

        console.log('✨ Backfill concluído com sucesso!');
    } catch (error) {
        console.error('❌ Erro durante o backfill:', error);
        process.exit(1);
    }
}

main().then(() => process.exit(0));
