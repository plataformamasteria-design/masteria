import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function run() {
  console.log("Cleaning up orphaned contacts and leads...");

  // Delete all contacts that do not have any conversations
  const result = await db.execute(sql`
    DELETE FROM contacts 
    WHERE NOT EXISTS (
      SELECT 1 FROM conversations WHERE conversations.contact_id = contacts.id
    )
  `);

  console.log("Orphaned contacts deleted. Leads are automatically deleted due to ON DELETE CASCADE.");
  
  process.exit(0);
}
run();
