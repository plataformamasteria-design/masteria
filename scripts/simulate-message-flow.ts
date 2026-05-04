
import { db } from '../src/lib/db';
import { contacts, conversations, messages, connections } from '../src/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { processIncomingMessageTrigger } from '../src/lib/automation-engine';

async function main() {
  console.log('🚀 [Simulation] Starting Message Flow Simulation...');

  // --- MOCK DATA ---
  // Using the phone number from the logs that failed
  const phoneNumber = '556231426957'; 
  const pushName = 'Simulated User';
  const companyId = '747cd644-328f-435b-b391-6fc919b9cbf2'; // Correct Company ID from DB
  // We need a valid connection ID. From previous logs: f34348ce-8edb-4f97-836c-d7e37202e584
  const connectionId = 'f34348ce-8edb-4f97-836c-d7e37202e584';
  
  const msgId = 'SIM_' + Date.now(); // Unique ID to avoid duplicate error during this test
  const messageContent = 'Olá, gostaria de saber mais sobre os planos.';
  
  console.log(`[Simulation] Mock Data: Phone=${phoneNumber}, Conn=${connectionId}, MsgID=${msgId}`);

  try {
    // --- STEP 1: CONTACT (Logic copied from baileys-session-manager.ts) ---
    console.log('[Simulation] 1. Finding/Creating Contact...');
    
    let contact = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.phone, phoneNumber),
          eq(contacts.companyId, companyId),
          isNull(contacts.deletedAt)
        )
      });

    if (contact) {
        console.log(`[Simulation] ✅ Contact Found: ${contact.id}`);
        // Simulate update
        const [updatedContact] = await db.update(contacts)
            .set({ whatsappName: pushName })
            .where(eq(contacts.id, contact.id))
            .returning();
        contact = updatedContact;
    } else {
        console.log(`[Simulation] ⚠️ Contact Not Found. Creating...`);
        const [newContact] = await db.insert(contacts)
            .values({
              companyId,
              name: pushName || phoneNumber,
              phone: phoneNumber,
              whatsappName: pushName,
              isGroup: false,
            })
            .returning();
        contact = newContact;
        console.log(`[Simulation] ✅ Contact Created: ${contact.id}`);
    }

    if (!contact) throw new Error('Contact is null');

    // --- STEP 2: CONVERSATION ---
    console.log('[Simulation] 2. Finding/Creating Conversation...');

    let conversation = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.contactId, contact.id),
          eq(conversations.connectionId, connectionId)
        )
    });

    if (conversation) {
        console.log(`[Simulation] ✅ Conversation Found: ${conversation.id}`);
        const [updatedConv] = await db.update(conversations)
            .set({
              lastMessageAt: new Date(),
              archivedAt: null,
            })
            .where(eq(conversations.id, conversation.id))
            .returning();
        conversation = updatedConv;
    } else {
        console.log(`[Simulation] ⚠️ Conversation Not Found. Creating...`);
        const [newConv] = await db.insert(conversations)
            .values({
              companyId,
              contactId: contact.id,
              connectionId,
              status: 'NEW',
              lastMessageAt: new Date(),
            })
            .returning();
        conversation = newConv;
        console.log(`[Simulation] ✅ Conversation Created: ${conversation.id}`);
    }

    if (!conversation) throw new Error('Conversation is null');

    // --- STEP 3: MESSAGE ---
    console.log('[Simulation] 3. Inserting Message...');

    const [savedMessage] = await db.insert(messages).values({
        companyId,
        conversationId: conversation.id,
        providerMessageId: msgId,
        senderType: 'USER',
        senderId: contact.id,
        content: messageContent,
        contentType: 'text',
        status: 'received',
        sentAt: new Date(),
      })
      .onConflictDoNothing({ target: [messages.providerMessageId] })
      .returning();

    if (!savedMessage) {
        console.log('[Simulation] ❌ Message Insert Failed (Likely Duplicate)');
    } else {
        console.log(`[Simulation] ✅ Message Saved: ${savedMessage.id}`);
        
        // --- STEP 4: AUTOMATION ---
        console.log('[Simulation] 4. Triggering Automation Engine...');
        
        // Mock the Baileys socket object just enough for the function
        const mockSocket = {
            sendMessage: async (jid: string, content: any) => {
                console.log(`[Simulation] 🤖 BOT SENDING MESSAGE to ${jid}:`, content);
                return { key: { id: 'BOT_REPLY_' + Date.now() } };
            },
            user: { id: 'bot_me' }
        };

        // Correct signature: (conversationId: string, messageId: string, options?: object)
        await processIncomingMessageTrigger(
            conversation.id,
            savedMessage.id,
            { dryRunSend: true } // Use dryRun to avoid actual sending errors in test env
        );
        
        console.log('[Simulation] ✅ Automation Triggered Successfully');
    }

  } catch (error) {
    console.error('[Simulation] ❌ CRITICAL ERROR:', error);
  }
  
  process.exit(0);
}

main();
