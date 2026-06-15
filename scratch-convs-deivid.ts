import 'dotenv/config';
import { db } from './src/lib/db';
import { conversations } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const result = await db.select({
      id: conversations.id,
      connectionId: conversations.connectionId,
      status: conversations.status
  }).from(conversations).where(eq(conversations.contactId, 'fff2ff46-11dd-420b-8261-e61031bdf96b'));
  console.log('Conversations:', result);
  process.exit(0);
}
run();
