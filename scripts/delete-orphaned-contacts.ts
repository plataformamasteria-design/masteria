
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function deleteOrphans() {
  console.log('Deleting orphaned contacts...');
  
  const result = await db.execute(sql`
    DELETE FROM contacts
    WHERE company_id NOT IN (SELECT id FROM companies);
  `);
  
  console.log('Deleted orphaned contacts.');
  process.exit(0);
}

deleteOrphans();
