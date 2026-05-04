// src/scripts/run-followup-mode-migration.ts
// Script to add followup_mode and followup_days_count columns to ai_personas

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function runMigration() {
    console.log('🚀 Running Follow-up Mode Migration...\n');

    try {
        // Add followup_mode column
        console.log('Adding followup_mode column...');
        await db.execute(sql`
      ALTER TABLE ai_personas 
      ADD COLUMN IF NOT EXISTS followup_mode TEXT DEFAULT 'minutes' NOT NULL
    `);
        console.log('✅ followup_mode column added');

        // Add followup_days_count column
        console.log('Adding followup_days_count column...');
        await db.execute(sql`
      ALTER TABLE ai_personas 
      ADD COLUMN IF NOT EXISTS followup_days_count INTEGER DEFAULT 7 NOT NULL
    `);
        console.log('✅ followup_days_count column added');

        // Verify columns exist
        const result = await db.execute(sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'ai_personas' 
      AND column_name IN ('followup_mode', 'followup_days_count')
    `);

        console.log('\n📊 Migration Result:');
        console.log(result);

        console.log('\n✅ Migration completed successfully!');
        console.log('ℹ️  Follow-up now supports two modes:');
        console.log('   - "minutes": Interval-based follow-up (existing behavior)');
        console.log('   - "daily": One message per day for X consecutive days');

    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }

    process.exit(0);
}

runMigration();
