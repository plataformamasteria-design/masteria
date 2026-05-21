import { db } from './src/lib/db';
import { messages, conversations, contacts, connections } from './src/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getPhoneVariations, canonicalizeBrazilPhone } from './src/lib/utils';

async function testWebhookSim() {
  const companyId = "c89d2d48-8df0-4b36-a3d1-9da03ccbc99e"; // Assuming first connection company
  const phone = "5511999999999";
  const pushName = "Test Contact";
  
  // Find a connection
  const [conn] = await db.select().from(connections).where(eq(connections.isActive, true)).limit(1);
  if (!conn) throw new Error("No active connection found");
  
  console.log("Simulating for connection:", conn.id);

  try {
    const txResult = await db.transaction(async (tx) => {
      const phoneVariations = getPhoneVariations(phone);
      console.log("Phone variations:", phoneVariations);
      
      let [contact] = await tx.select().from(contacts).where(and(eq(contacts.companyId, conn.companyId!), inArray(contacts.phone, phoneVariations)));
      
      if (!contact) {
          console.log("Contact not found, inserting...");
          const canonicalPhone = canonicalizeBrazilPhone(phone);
          [contact] = await tx.insert(contacts).values({
              companyId: conn.companyId!,
              name: pushName,
              whatsappName: pushName,
              phone: canonicalPhone,
              status: 'ACTIVE'
          }).returning();
      } else {
          console.log("Contact found:", contact.id);
      }

      let [conversation] = await tx.select().from(conversations).where(and(
          eq(conversations.companyId, conn.companyId!),
          eq(conversations.contactId, contact.id)
      ));

      if (!conversation) {
          console.log("Conversation not found, inserting...");
          [conversation] = await tx.insert(conversations).values({
              companyId: conn.companyId!,
              contactId: contact.id,
              connectionId: conn.id,
              status: 'NEW',
          }).returning();
      } else {
          console.log("Conversation found:", conversation.id);
          const updatePayload: any = { lastMessageAt: new Date(), connectionId: conn.id };
          [conversation] = await tx.update(conversations).set(updatePayload).where(eq(conversations.id, conversation.id)).returning();
      }

      const conversationId = conversation.id;
      console.log("Conversation ID:", conversationId);

      const messageId = "test-msg-" + Date.now();

      const [newMsg] = await tx.insert(messages).values({
          companyId: conn.companyId,
          conversationId,
          connectionId: conn.id,
          providerMessageId: messageId,
          senderType: 'CONTACT',
          content: "Test message",
          contentType: "TEXT",
          status: 'RECEIVED'
      }).returning();
      
      console.log("Message inserted:", newMsg.id);

      return {
          ignored: false,
          messageId: newMsg.id,
          conversationId: conversation.id,
          contactId: contact.id,
      };
    });
    
    console.log("TX Result:", txResult);
  } catch (err) {
    console.error("TX ERROR:", err);
  }
  process.exit(0);
}

testWebhookSim().catch(console.error);
