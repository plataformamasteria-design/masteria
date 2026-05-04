
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function checkData() {
  const result = await db.execute(sql`
    SELECT id, enabled_notifications 
    FROM notification_agents 
    LIMIT 5;
  `);
  
  console.log(result);
  process.exit(0);
}

checkData();
