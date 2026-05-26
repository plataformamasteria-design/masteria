import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function run() {
  const companyId = 'b6941198-d147-495f-9721-e771e8f237ef';
  const boardId = 'b8856169-d5ee-40ea-a876-20c8b46234cf';

  const res = await db.execute(sql`
    EXPLAIN ANALYZE
    SELECT *
    FROM kanban_leads kl
    INNER JOIN contacts c ON kl.contact_id = c.id
    WHERE kl.board_id = ${boardId} 
      AND kl.company_id = ${companyId}
      AND c.company_id = ${companyId}
  `);

  res.forEach(r => console.log(r['QUERY PLAN']));
}

run().catch(console.error).finally(() => process.exit(0));
