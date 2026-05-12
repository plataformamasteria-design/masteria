import { db } from './src/lib/db';
import { messages } from './src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const conversationId = 'daf60748-dc7c-4ae8-8b36-e3ee59264c38'; // Note: Wait, this was Leandro Barros. 
  // Let me find the conversation for Marcelo Rego de Almeida instead.
  // Wait, I can search the messages by the text "Já pensei nisso" or similar.
  const msgs = await db.select().from(messages)
    .orderBy(desc(messages.sentAt))
    .limit(10);
  
  for (const m of msgs.reverse()) {
    if (m.mediaUrl) {
      console.log(`\nMEDIA MSG -> [${m.sentAt}] Conv: ${m.conversationId} Type: ${m.contentType} Content: ${m.content} AI_Trans: ${(m as any).aiTranscription}`);
    }
    // Also print recent audio messages
    if (m.contentType === 'audio' || m.contentType === 'ptt') {
      console.log(`\nAUDIO MSG -> [${m.sentAt}] Conv: ${m.conversationId} Content: ${m.content} AI_Trans: ${(m as any).aiTranscription}`);
    }
  }

  process.exit(0);
}

run().catch(console.error);
