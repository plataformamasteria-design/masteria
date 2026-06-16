import { db } from '../src/lib/db';
import { contacts, automationFlowExecutions, messages } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function run() {
  const phone = '5588920008007';
  console.log(`Searching for contact with phone: ${phone}`);
  
  const contactList = await db.select().from(contacts).where(eq(contacts.phone, phone)).limit(1);
  if (!contactList.length) {
    console.log('Contact not found');
    process.exit(1);
  }
  
  const contact = contactList[0];
  console.log(`Contact ID: ${contact.id}`);
  
  const execs = await db.select().from(automationFlowExecutions)
    .where(eq(automationFlowExecutions.contactId, contact.id))
    .orderBy(desc(automationFlowExecutions.startedAt))
    .limit(5);
    
  console.log(`Found ${execs.length} executions:`);
  for (const ex of execs) {
    console.log(`- ID: ${ex.id}, Status: ${ex.status}, Step: ${ex.currentStepId}, Flow: ${ex.flowId}, LastUpdated: ${ex.lastUpdatedAt}`);
  }
  
  process.exit(0);
}

run().catch(console.error);
