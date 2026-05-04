// src/scripts/apply-hard-isolation.ts
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🛡️  Aplicando Blindagem de Isolamento Absoluto (Fase Estrutural)...');

    const ALLOWED_TABLES = [
        'messages',
        'kanban_leads',
        'message_reactions',
        'message_templates',
        'whatsapp_delivery_reports',
        'sms_delivery_reports',
        'voice_delivery_reports',
        'ai_chat_messages',
        'baileys_auth_state',
        'contacts_to_tags',
        'contacts_to_contact_lists',
        'ai_chats'
    ] as const;

    for (const table of ALLOWED_TABLES) {
        try {
            console.log(`📡 Hardening table: ${table}...`);
            await db.execute(sql`
                ALTER TABLE ${sql.identifier(table)} 
                ADD COLUMN IF NOT EXISTS company_id TEXT 
                REFERENCES companies(id) ON DELETE CASCADE;
            `);
            console.log(`✅ Table ${table} hardened.`);
        } catch (error: any) {
            console.error(`❌ Error hardening table ${table}:`, error.message);
        }
    }

    console.log('✨ Blindagem Estrutural concluída!');
}

main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
