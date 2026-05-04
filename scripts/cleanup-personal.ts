import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function run() {
  // Search by name too
  const contacts = await db.execute(sql`
    SELECT id, name, phone FROM contacts 
    WHERE LOWER(name) LIKE '%ezequiel%' OR phone LIKE '%999427123%' OR phone LIKE '%55999427123%'
  `);
  console.log('Contacts found:', JSON.stringify(contacts.rows || contacts, null, 2));
  
  if ((contacts.rows || contacts as any[]).length > 0) {
    const contactIds = (contacts.rows || contacts as any[]).map((c: any) => c.id);
    console.log('Contact IDs to clean:', contactIds);
    
    for (const cid of contactIds) {
      // Delete messages
      await db.execute(sql`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE contact_id = ${cid})`);
      // Delete conversations
      await db.execute(sql`DELETE FROM conversations WHERE contact_id = ${cid}`);
      // Delete contact
      await db.execute(sql`DELETE FROM contacts WHERE id = ${cid}`);
      console.log(`Cleaned contact ${cid}`);
    }
    console.log('✅ All cleaned');
  } else {
    console.log('✅ No personal data found - already clean');
  }
  
  process.exit(0);
}
run();
