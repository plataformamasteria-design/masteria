import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';
async function run() {
  try {
    const res = await db.execute(sql`SELECT m.id, m.content, m.sent_at, m.status, c.phone as contact_phone FROM messages m JOIN conversations cv ON m.conversation_id = cv.id JOIN contacts c ON cv.contact_id = c.id WHERE m.content ILIKE '%Teste recebimento Formulário%'`);
    console.log(JSON.stringify(res.rows || res, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
