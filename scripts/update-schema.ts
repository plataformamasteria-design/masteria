import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db';

async function updateSchema() {
  try {
    console.log('Starting database schema update...');
    
    // Add connectionType column to connections table if it doesn't exist
    await db.execute(sql`
      ALTER TABLE connections 
      ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'meta_api' NOT NULL
    `);
    console.log('✓ Added connectionType column to connections table');
    
    // Create whatsapp_qr_sessions table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS whatsapp_qr_sessions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        session_data JSONB,
        phone_number VARCHAR(50),
        is_active BOOLEAN DEFAULT false NOT NULL,
        last_connected_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log('✓ Created whatsapp_qr_sessions table');
    
    console.log('Database schema update completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating schema:', error);
    process.exit(1);
  }
}

updateSchema();