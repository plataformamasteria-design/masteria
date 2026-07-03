import 'dotenv/config';
import postgres from 'postgres';

async function migrate() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error('No DATABASE_URL');
  
  const sql = postgres(DATABASE_URL);
  
  try {
    console.log("Adding active column to companies...");
    await sql`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL;`;
    console.log("Migration complete.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await sql.end();
  }
}

migrate();
