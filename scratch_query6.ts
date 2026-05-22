import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';
async function run() {
  try {
    const res = await db.execute(sql`SELECT m.id, m.content, m.sent_at, m.status, c.phone as contact_phone FROM messages m JOIN conversations cv ON m.conversation_id = cv.id JOIN contacts c ON cv.contact_id = c.id WHERE cv.connection_id = '8f2c21fa-04be-4b26-9063-a9fc90a8f70b' ORDER BY m.sent_at DESC LIMIT 10`);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
