
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function checkOrphans() {
  console.log('Checking orphaned contacts...');
  
  // Count orphans
  const result = await db.execute(sql`
    SELECT count(*) as count
    FROM contacts
    WHERE company_id NOT IN (SELECT id FROM companies);
  `);
  
  console.log('Orphaned contacts count:', result[0].count);
  
  // List orphans sample
  const orphans = await db.execute(sql`
    SELECT id, name, company_id
    FROM contacts
    WHERE company_id NOT IN (SELECT id FROM companies)
    LIMIT 5;
  `);
  
  console.log('Sample orphans:', orphans);
  
  process.exit(0);
}

checkOrphans();
