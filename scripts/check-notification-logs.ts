
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function checkLogs() {
  const result = await db.execute(sql`
    SELECT count(*) FROM notification_logs;
  `);
  
  console.log(result);
  process.exit(0);
}

checkLogs();
