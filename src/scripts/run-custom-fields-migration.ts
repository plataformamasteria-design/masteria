// Script para adicionar coluna custom_fields à tabela contacts
// Necessário porque o schema Drizzle inclui esta coluna mas a migração nunca foi aplicada
// IMPACTO: Sem esta coluna, TODAS as queries db.select().from(contacts) falham,
//          bloqueando processIncomingMessageTrigger e impedindo respostas de IA.
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🚀 Running migration: add custom_fields column to contacts table');

    try {
        // Add custom_fields column (JSONB, nullable) — IF NOT EXISTS for idempotency
        await db.execute(sql`
            ALTER TABLE contacts 
            ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT NULL
        `);
        console.log('✅ custom_fields column added to contacts table');
    } catch (e: any) {
        if (e.message?.includes('already exists')) {
            console.log('ℹ️ custom_fields column already exists in contacts table');
        } else {
            throw e;
        }
    }

    // Verify
    const result: any = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'custom_fields'
    `);

    const rows = Array.isArray(result) ? result : (result.rows || []);
    if (rows.length > 0) {
        console.log('✅ VERIFICADO: Coluna custom_fields existe na tabela contacts');
        console.log('   Tipo:', rows[0].data_type);
    } else {
        console.error('❌ ERRO: Coluna custom_fields NÃO encontrada após migração!');
        process.exit(1);
    }

    console.log('✅ Migration completed successfully!');
    process.exit(0);
}

main().catch(e => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
});
