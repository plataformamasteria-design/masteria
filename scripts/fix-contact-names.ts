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
    console.log("Fixing historical contact names...");
    
    await db.execute(sql`
        UPDATE contacts 
        SET name = whatsapp_name 
        WHERE name = phone 
        AND whatsapp_name IS NOT NULL 
        AND whatsapp_name != '';
    `);

    console.log("Contact names fixed successfully!");
  } catch (error) {
    console.error("Fix failed:", error);
  } finally {
    await client.end();
  }
}

main();
