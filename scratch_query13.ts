import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';
async function run() {
  try {
    const res = await db.execute(sql`SELECT m.id, m.content, m.sent_at, m.status, m.connection_id, conn.config_name FROM messages m JOIN conversations cv ON m.conversation_id = cv.id JOIN connections conn ON m.connection_id = conn.id JOIN contacts c ON cv.contact_id = c.id WHERE c.phone ILIKE '%88920008007%' ORDER BY m.sent_at DESC LIMIT 10`);
    console.log(JSON.stringify(res.rows || res, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
