import { db } from '../src/lib/db';
import { kanbanLeads, conversations } from '../src/lib/db/schema';

async function main() {
  const sampleLead = await db.select().from(kanbanLeads).limit(1);
  if (sampleLead.length > 0) {
      console.log('\n--- KanbanLead Keys ---');
      console.log(Object.keys(sampleLead[0]));
  }

  const sampleConv = await db.select().from(conversations).limit(1);
  if (sampleConv.length > 0) {
      console.log('\n--- Conversation Keys ---');
      console.log(Object.keys(sampleConv[0]));
  }
  
  process.exit(0);
}

main().catch(console.error);
