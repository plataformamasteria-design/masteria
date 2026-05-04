import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function run() {
  const connectionId = '9b5f2ea2-17ec-4957-86e9-e5fa3ea11019'; // "ezequiel" 555599427123

  console.log(`Starting cleanup for connection ${connectionId}...`);

  // 1. Delete all messages from conversations linked to this connection
  const delMsgs = await db.execute(sql`
    DELETE FROM messages 
    WHERE conversation_id IN (
      SELECT id FROM conversations WHERE connection_id = ${connectionId}
    )
  `);
  console.log(`Deleted messages.`);

  // 2. Delete conversations
  const delConvs = await db.execute(sql`
    DELETE FROM conversations WHERE connection_id = ${connectionId}
  `);
  console.log(`Deleted conversations.`);

  // Note: we don't necessarily delete the contacts themselves since other 
  // connections might have interacted with them, but usually they are isolated per company.
  // The user only asked to delete the "conversations".

  console.log('✅ Connection conversations cleanup complete.');
  process.exit(0);
}
run();
