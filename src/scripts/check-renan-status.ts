
import { db } from '../lib/db';
import { contacts, messages, connections } from '../lib/db/schema';
import { ilike, desc, eq, and } from 'drizzle-orm';

async function main() {
  console.log('--- Checking for Renan Juste ---');
  const renanContacts = await db.select().from(contacts).where(ilike(contacts.name, '%Renan Juste%'));
  
  if (renanContacts.length === 0) {
    console.log('❌ Contact "Renan Juste" not found in DB.');
  } else {
    for (const contact of renanContacts) {
      console.log(`✅ Found Contact: ${contact.name} (Phone: ${contact.phone}, ID: ${contact.id})`);
      
      const recentMessages = await db.select().from(messages)
        .where(eq(messages.conversationId, contact.id)) // Wait, conversationId is usually not contactId. Need to join conversations or search by senderId/contact phone.
        // Actually messages has conversationId. Let's search by senderId if it matches contact.id, OR join conversations.
        // Simpler: search messages where senderId = contact.id
        // But better: find conversation first.
        
      // Let's search messages by senderId (USER messages)
      const userMsgs = await db.select().from(messages)
        .where(eq(messages.senderId, contact.id))
        .orderBy(desc(messages.sentAt))
        .limit(5);
        
      console.log(`   Recent Messages from ${contact.name}:`);
      if (userMsgs.length === 0) console.log('   (No messages found)');
      for (const msg of userMsgs) {
        console.log(`   - [${msg.sentAt}] ${msg.content} (Status: ${msg.status})`);
      }
    }
  }

  console.log('\n--- Checking for Duplicate Connections ---');
  const allConnections = await db.select().from(connections);
  const phoneMap = new Map<string, typeof connections.$inferSelect[]>();

  for (const conn of allConnections) {
    if (!conn.phone) continue;
    const cleanPhone = conn.phone.replace(/\D/g, '');
    if (!phoneMap.has(cleanPhone)) {
      phoneMap.set(cleanPhone, []);
    }
    phoneMap.get(cleanPhone)?.push(conn);
  }

  for (const [phone, conns] of phoneMap.entries()) {
    if (conns.length > 1) {
      console.log(`⚠️  Duplicate Connections for Phone ${phone}:`);
      for (const c of conns) {
        console.log(`   - ID: ${c.id} | Type: ${c.connectionType} | Status: ${c.status} | Name: ${c.config_name}`);
      }
    }
  }
}

main().catch(console.error).then(() => process.exit(0));
