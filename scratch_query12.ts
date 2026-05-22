import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';
async function run() {
  try {
    const res = await db.execute(sql`SELECT id, content FROM messages ORDER BY sent_at DESC LIMIT 5`);
    console.log(JSON.stringify(res.rows || res, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
