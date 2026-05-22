import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function check() {
  const q = `
    SELECT 'users' as tbl, id FROM users WHERE id = 'f28e5adf-ce84-436b-94c5-cd3941f254b7'
    UNION ALL
    SELECT 'teams' as tbl, id FROM teams WHERE id = 'f28e5adf-ce84-436b-94c5-cd3941f254b7'
    UNION ALL
    SELECT 'kanban_boards' as tbl, id FROM kanban_boards WHERE id = 'f28e5adf-ce84-436b-94c5-cd3941f254b7'
    UNION ALL
    SELECT 'automations' as tbl, id FROM automations WHERE id = 'f28e5adf-ce84-436b-94c5-cd3941f254b7'
    UNION ALL
    SELECT 'connections' as tbl, id FROM connections WHERE id = 'f28e5adf-ce84-436b-94c5-cd3941f254b7'
  `;
  const res = await db.execute(sql.raw(q));
  console.log(res);
  process.exit(0);
}
check().catch(console.error);
