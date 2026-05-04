import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db';

async function pushSchema() {
  try {
    console.log('🔄 Starting database schema update for Baileys...');
    
    console.log('📝 Modifying connections table for Baileys support...');
    await db.execute(sql`
      ALTER TABLE connections 
      ALTER COLUMN waba_id DROP NOT NULL,
      ALTER COLUMN phone_number_id DROP NOT NULL,
      ALTER COLUMN access_token DROP NOT NULL,
      ALTER COLUMN webhook_secret DROP NOT NULL,
      ALTER COLUMN app_secret DROP NOT NULL
    `);
    console.log('✓ Made Meta API fields nullable');
    
    await db.execute(sql`
      ALTER TABLE connections 
      ADD COLUMN IF NOT EXISTS session_id TEXT,
      ADD COLUMN IF NOT EXISTS phone TEXT,
      ADD COLUMN IF NOT EXISTS qr_code TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT,
      ADD COLUMN IF NOT EXISTS last_connected TIMESTAMP
    `);
    console.log('✓ Added Baileys-specific fields');
    
    console.log('📝 Creating baileys_auth_state table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS baileys_auth_state (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        creds JSONB,
        keys JSONB,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log('✓ Created baileys_auth_state table');
    
    console.log('✅ Database schema update completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating schema:', error);
    process.exit(1);
  }
}

pushSchema();
