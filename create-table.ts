import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS company_credentials (
        company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
        openai_api_key TEXT,
        gemini_api_key TEXT,
        elevenlabs_api_key TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Table company_credentials created successfully!');
  } catch (err) {
    console.error('❌ Error:', err);
  }
  process.exit(0);
}

main();
