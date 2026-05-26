import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function run() {
  const companyId = 'b6941198-d147-495f-9721-e771e8f237ef';
  const boardId = 'b8856169-d5ee-40ea-a876-20c8b46234cf';

  const start = performance.now();
  const res = await db.execute(sql`
    SELECT kl.*, c.id as c_id, c.name as c_name, c.custom_fields
    FROM kanban_leads kl
    INNER JOIN contacts c ON kl.contact_id = c.id
    WHERE kl.board_id = ${boardId} 
  `);
  console.log(`Raw query executed in ${performance.now() - start}ms (${res.length} rows)`);
}

run().catch(console.error).finally(() => process.exit(0));
