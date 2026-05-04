
import { db, automationLogs } from '../lib/db/index.ts';
import { desc } from 'drizzle-orm';

async function main() {
  console.log('--- FETCHING RECENT AUTOMATION LOGS ---');
  const logs = await db.select().from(automationLogs).orderBy(desc(automationLogs.createdAt)).limit(20);
  
  logs.forEach(log => {
    console.log(`[${log.createdAt.toISOString()}] [${log.level}] [Conv:${log.conversationId}] ${log.message}`);
    if (log.details) {
      console.log('Details:', JSON.stringify(log.details, null, 2));
    }
    console.log('---');
  });
}

main().catch(console.error);
