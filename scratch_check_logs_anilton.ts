import { db } from './src/lib/db';
import { automationLogs } from './src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const convId = '351c4bd1-e947-4373-8fa7-2916b96d0d49';
  
  const logs = await db.select().from(automationLogs)
    .where(eq(automationLogs.conversationId, convId))
    .orderBy(desc(automationLogs.createdAt))
    .limit(20);
    
  for (const l of logs.reverse()) {
    console.log(`[${l.createdAt}] ${l.level}: ${l.message}`);
  }
  process.exit(0);
}

run().catch(console.error);
