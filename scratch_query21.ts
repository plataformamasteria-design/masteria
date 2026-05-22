import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';
async function run() {
  try {
    const res = await db.execute(sql`SELECT id, config_name, connection_type FROM connections WHERE id = '40ce44df-90a6-4dc5-8f65-8b7cdebe866b'`);
    console.log(JSON.stringify(res.rows || res, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
