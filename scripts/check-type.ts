import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';

async function run() {
  const q = await db.execute(sql`SELECT data_type FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'sent_at'`);
  fs.writeFileSync('db_type.json', JSON.stringify(q.rows || q, null, 2));
  process.exit(0);
}
run();
