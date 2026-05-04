// Script para deletar dados do contato 55999427123
import { db } from '../src/lib/db';
import { contacts, conversations, messages } from '../src/lib/db/schema';
import { like, eq } from 'drizzle-orm';

async function run() {
  const found = await db.select({ id: contacts.id, phone: contacts.phone, name: contacts.name })
    .from(contacts)
    .where(like(contacts.phone, '%999427123%'));

  console.log('Found contacts:', JSON.stringify(found, null, 2));

  for (const c of found) {
    const convs = await db.select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.contactId, c.id));

    console.log(`Conversations for ${c.phone}: ${convs.length}`);

    for (const conv of convs) {
      const del = await db.delete(messages).where(eq(messages.conversationId, conv.id));
      console.log(`  Deleted messages from conv ${conv.id}`);
    }

    await db.delete(conversations).where(eq(conversations.contactId, c.id));
    console.log(`  Deleted conversations`);

    await db.delete(contacts).where(eq(contacts.id, c.id));
    console.log(`  Deleted contact: ${c.phone} (${c.name})`);
  }

  console.log('\n✅ Cleanup done!');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
