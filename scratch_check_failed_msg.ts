import { db } from './src/lib/db';
import { messages } from './src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function run() {
  try {
    const msgs = await db.query.messages.findMany({
      where: eq(messages.conversationId, '054be43a-7ab3-4e19-adaf-2aa158ad7665'),
      orderBy: [desc(messages.sentAt)],
      limit: 5
    });
    console.log(msgs.map(m => ({
      id: m.id,
      content: m.content,
      status: m.status,
      errorCode: m.errorCode,
      errorMessage: m.errorMessage,
      messageType: m.messageType
    })));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
