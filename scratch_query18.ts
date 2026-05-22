import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';
async function run() {
  try {
    const res = await db.execute(sql`SELECT id, provider_message_id, status FROM messages WHERE id = '7724fd18-d98b-4356-a399-e7b0eb60bbbe'`);
    console.log(JSON.stringify(res.rows || res, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
