import 'dotenv/config';
import { db } from './src/lib/db';
import { messages, conversations } from './src/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

async function main() {
  const companyId = 'ef81f147-3d92-494b-a913-c3599933fc00';
  
  // Find recent messages in the company where senderType is AGENT or fromMe is true
  const recentAgentMsgs = await db.select({
    id: messages.id,
    content: messages.content,
    senderType: messages.senderType,
    status: messages.status,
    sentAt: messages.sentAt,
    conversationId: messages.conversationId,
    providerMessageId: messages.providerMessageId
  })
  .from(messages)
  .where(
    and(
      eq(messages.companyId, companyId),
      eq(messages.senderType, 'AGENT')
    )
  )
  .orderBy(desc(messages.sentAt))
  .limit(20);

  console.log('Recent AGENT messages:', JSON.stringify(recentAgentMsgs, null, 2));

  // Find recent CONTACT messages just to compare
  const recentContactMsgs = await db.select({
    id: messages.id,
    content: messages.content,
    senderType: messages.senderType,
    status: messages.status,
    sentAt: messages.sentAt
  })
  .from(messages)
  .where(
    and(
      eq(messages.companyId, companyId),
      eq(messages.senderType, 'CONTACT')
    )
  )
  .orderBy(desc(messages.sentAt))
  .limit(5);
  
  console.log('Recent CONTACT messages:', JSON.stringify(recentContactMsgs, null, 2));
}

main().catch(console.error).then(() => process.exit(0));
