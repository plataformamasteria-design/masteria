
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function checkSchema() {
  const result = await db.execute(sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns 
    WHERE table_name = 'notification_agents';
  `);
  
  console.log(result);
  process.exit(0);
}

checkSchema();
