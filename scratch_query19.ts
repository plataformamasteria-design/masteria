import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';
async function run() {
  try {
    const res = await db.execute(sql`SELECT id, config_name, external_id FROM connections WHERE config_name ILIKE '%Bruno%'`);
    console.log(JSON.stringify(res.rows || res, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
