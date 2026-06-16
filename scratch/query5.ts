import { db } from '../src/lib/db';
import { automationLogs, conversations } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function run() {
  const contactId = 'ed4d2caa-494f-4237-86ea-062273a1107f';
  const conv = await db.select().from(conversations).where(eq(conversations.contactId, contactId)).limit(1);
  if (!conv.length) return console.log('no conv');
  
  console.log('Conv:', conv[0].id);
  const logs = await db.select().from(automationLogs)
    .where(eq(automationLogs.conversationId, conv[0].id))
    .orderBy(desc(automationLogs.createdAt))
    .limit(50);
    
  console.log(`Recent Automation Logs:`);
  for (const log of logs.reverse()) {
    console.log(`[${log.createdAt}] ${log.level}: ${log.message} - ${JSON.stringify(log.details)}`);
  }
  
  process.exit(0);
}

run().catch(console.error);
