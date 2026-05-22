import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';
import { kanbanLeads } from './src/lib/db/schema';

async function test() {
  const c = await db.execute(sql`
      WITH ranked_conversations AS (
        SELECT 
          c.id,
          c.connection_id as "connectionId"
        FROM conversations c
        LIMIT 1
      )
      SELECT 
        id,
        "connectionId"
      FROM ranked_conversations
    `);
  console.log(JSON.stringify(c, null, 2));
  process.exit(0);
}
test();
