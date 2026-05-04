import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';

async function run() {
  const msgs = await db.execute(sql`SELECT content, sent_at, sender_type, provider_message_id FROM messages WHERE sender_type = 'AGENT' ORDER BY sent_at DESC LIMIT 15`);
  fs.writeFileSync('db_dates.json', JSON.stringify(msgs.rows || msgs, null, 2));
  process.exit(0);
}
run();
