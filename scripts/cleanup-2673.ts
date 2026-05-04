import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function run() {
  const phoneFilter = '%2673';
  
  // 1. Find the contact(s)
  const contacts = await db.execute(sql`
    SELECT id, phone FROM contacts WHERE phone LIKE '%2673'
  `);
  
  const rows = contacts.rows || contacts as any[];
  
  if (rows.length > 0) {
    const contactIds = rows.map((c: any) => c.id);
    console.log('Found contacts:', rows);

    for (const cid of contactIds) {
      // Delete messages
      await db.execute(sql`
        DELETE FROM messages 
        WHERE conversation_id IN (SELECT id FROM conversations WHERE contact_id = ${cid})
      `);
      console.log(`Deleted messages for contact ${cid}`);

      // Delete conversations
      await db.execute(sql`
        DELETE FROM conversations WHERE contact_id = ${cid}
      `);
      console.log(`Deleted conversations for contact ${cid}`);

      // Delete contact (kanban_leads will be deleted by CASCADE)
      await db.execute(sql`
        DELETE FROM contacts WHERE id = ${cid}
      `);
      console.log(`Deleted contact ${cid}`);
    }
    console.log('✅ Cleaned up conversations and contact for number ending in 2673.');
  } else {
    console.log('No contacts found ending in 2673.');
  }
  
  process.exit(0);
}
run();
