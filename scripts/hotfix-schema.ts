import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import "dotenv/config";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is missing in .env');
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    console.log("Applying hotfix schema updates to automation_flows...");
    
    // Check if column exists, if not, ADD COLUMN
    await db.execute(sql`
        ALTER TABLE automation_flows 
        ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'stage_entry' NOT NULL,
        ADD COLUMN IF NOT EXISTS webhook_token TEXT,
        ADD COLUMN IF NOT EXISTS schedule_config JSONB;
    `);

    console.log("Hotfix schema applied successfully!");
  } catch (error) {
    console.error("Migration hotfix failed:", error);
  } finally {
    await client.end();
  }
}

main();
