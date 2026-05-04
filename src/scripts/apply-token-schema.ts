// src/scripts/apply-token-schema.ts
// Run this to manually apply token metadata columns to the database

import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🔧 Applying token metadata schema changes...\n');

    try {
        // Add token_type column
        console.log('Adding token_type column...');
        await db.execute(sql`ALTER TABLE connections ADD COLUMN IF NOT EXISTS token_type TEXT`);
        console.log('✅ token_type added');

        // Add token_expires_at column
        console.log('Adding token_expires_at column...');
        await db.execute(sql`ALTER TABLE connections ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP`);
        console.log('✅ token_expires_at added');

        // Add token_last_refreshed column
        console.log('Adding token_last_refreshed column...');
        await db.execute(sql`ALTER TABLE connections ADD COLUMN IF NOT EXISTS token_last_refreshed TIMESTAMP`);
        console.log('✅ token_last_refreshed added');

        // Add token_refresh_failed_at column
        console.log('Adding token_refresh_failed_at column...');
        await db.execute(sql`ALTER TABLE connections ADD COLUMN IF NOT EXISTS token_refresh_failed_at TIMESTAMP`);
        console.log('✅ token_refresh_failed_at added');

        // Add token_refresh_error column
        console.log('Adding token_refresh_error column...');
        await db.execute(sql`ALTER TABLE connections ADD COLUMN IF NOT EXISTS token_refresh_error TEXT`);
        console.log('✅ token_refresh_error added');

        // Verify columns were added
        console.log('\n📊 Verifying columns...');
        const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'connections' 
      AND column_name LIKE 'token_%'
      ORDER BY column_name
    `);

        console.log('\nToken-related columns in connections table:');
        console.table(result);

        console.log('\n✅ Schema migration completed successfully!');
    } catch (error) {
        console.error('\n❌ Error applying schema changes:', error);
        throw error;
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit(0));
