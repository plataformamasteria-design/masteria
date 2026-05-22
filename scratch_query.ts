import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';
async function run() {
  try {
    const res = await db.execute(sql`SELECT m.id, m.content, m.sent_at, c.phone as contact_phone FROM messages m JOIN conversations cv ON m.conversation_id = cv.id JOIN contacts c ON cv.contact_id = c.id WHERE m.content ILIKE '%Formul%' ORDER BY m.sent_at DESC LIMIT 5`);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
