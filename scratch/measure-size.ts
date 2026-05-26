import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function run() {
  const boardId = 'b8856169-d5ee-40ea-a876-20c8b46234cf';

  const start = performance.now();
  const res = await db.execute(sql`
    SELECT sum(pg_column_size(kl.*)) as kl_size, sum(pg_column_size(c.*)) as c_size
    FROM kanban_leads kl
    INNER JOIN contacts c ON kl.contact_id = c.id
    WHERE kl.board_id = ${boardId} 
  `);
  console.log(`Sizes:`, res[0]);
}

run().catch(console.error).finally(() => process.exit(0));
