// Script para adicionar ABORDAGEM ao enum agent_type no PostgreSQL
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🚀 Running migration: add ABORDAGEM to agent_type enum');

    try {
        // Add ABORDAGEM to agent_type enum
        await db.execute(sql`ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'ABORDAGEM'`);
        console.log('✅ ABORDAGEM added to agent_type enum');
    } catch (e: any) {
        if (e.message?.includes('already exists')) {
            console.log('ℹ️ ABORDAGEM already exists in agent_type enum');
        } else {
            throw e;
        }
    }

    // Verify
    const result = await db.execute(sql`
        SELECT unnest(enum_range(NULL::agent_type))::text AS value
    `);
    console.log('📋 Current enum values:', JSON.stringify(result, null, 2));

    process.exit(0);
}

main().catch(e => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
});
