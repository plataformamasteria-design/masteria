import { db } from '../src/lib/db';
import { sendUnifiedMessage } from '../src/services/unified-message-sender.service';
import { conversations, messages, connections, contacts } from '../src/lib/db/schema';
import { eq, and, not } from 'drizzle-orm';

async function main() {
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
  const userId = 'e6981cfd-c128-4458-ba81-1823eb5c6544'; 
  const contactId = '1141d685-1c51-4a2f-bab4-ad5e3bbb71b8';
  const connectionId = 'fbcbaa27-763a-4879-b2b7-7224784df1d1'; // Anderson Meneses
  const messageContent = 'Hello test message db transaction!';

  try {
      const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.companyId, companyId))).limit(1);
      const [connection] = await db.select().from(connections).where(and(eq(connections.id, connectionId), eq(connections.companyId, companyId))).limit(1);

      console.log(`Contact: ${contact.phone}`);

      const provider = ['baileys', 'evolution'].includes(connection.connectionType || '') ? 'baileys' : 'apicloud';
      
      const result = await sendUnifiedMessage({
          provider: provider,
          connectionId: connection.id,
          to: contact.phone as string,
          message: messageContent,
      });

      if (!result.success) {
          throw new Error(result.error || "Erro ao enviar mensagem.");
      }

      // DB Transaction - exactly as in actions/chat.ts
      let savedConvId = '';
      await db.transaction(async (tx) => {
          const [existing] = await tx.select().from(conversations).where(and(eq(conversations.contactId, contact.id), not(eq(conversations.status, 'archived')))).limit(1);
          
          if (existing) {
              savedConvId = existing.id;
              await tx.update(conversations).set({ assignedTo: userId, lastMessageAt: new Date() }).where(eq(conversations.id, savedConvId));
          } else {
              const [newConv] = await tx.insert(conversations).values({
                  companyId,
                  contactId: contact.id,
                  connectionId,
                  assignedTo: userId,
                  status: 'IN_PROGRESS',
                  aiActive: false,
                  lastMessageAt: new Date(),
              }).returning({ id: conversations.id });
              savedConvId = newConv.id;
          }

          await tx.insert(messages).values({
              companyId,
              conversationId: savedConvId,
              connectionId,
              providerMessageId: result.messageId,
              senderType: 'AGENT',
              senderId: userId,
              content: messageContent,
              status: 'SENT',
              sentAt: new Date(),
          });
      });

      console.log(`Action finished with success! ConvID: ${savedConvId}`);
  } catch (e) {
      console.error('Transaction Failed:');
      console.error(e);
  }
  
  process.exit(0);
}

main().catch(console.error);
