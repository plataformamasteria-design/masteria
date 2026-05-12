import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './src/lib/db';
import { companies, contacts, chatMessages, automationExecutions, conversations } from './src/lib/db/schema';
import { ilike, eq, desc, gte, and } from 'drizzle-orm';
import { startOfDay } from 'date-fns';

async function check() {
  console.log("Procurando por Henrique Felipe...");
  
  // Como company
  const companyMatches = await db.query.companies.findMany({
    where: ilike(companies.name, '%Henrique%Felipe%')
  });
  console.log(`Empresas encontradas: ${companyMatches.length}`);
  for (const c of companyMatches) {
    console.log(`- ID: ${c.id} | Name: ${c.name}`);
  }

  // Como contact
  const contactMatches = await db.query.contacts.findMany({
    where: ilike(contacts.name, '%Henrique%Felipe%')
  });
  console.log(`\nContatos encontrados: ${contactMatches.length}`);
  for (const c of contactMatches) {
    console.log(`- ID: ${c.id} | Name: ${c.name} | Phone: ${c.phone}`);
  }

  // Se encontrou contato, checar mensagens de hoje
  const today = startOfDay(new Date());
  
  for (const contact of contactMatches) {
    console.log(`\nChecando mensagens para o contato ${contact.name} (ID: ${contact.id}) desde ${today.toISOString()}...`);
    const msgs = await db.query.chatMessages.findMany({
      where: and(
        eq(chatMessages.contactId, contact.id),
        gte(chatMessages.createdAt, today)
      ),
      orderBy: [desc(chatMessages.createdAt)]
    });
    
    console.log(`Total de mensagens hoje: ${msgs.length}`);
    for (const m of msgs) {
      console.log(`[${m.createdAt}] Dir: ${m.direction} | Tipo: ${m.type} | Texto: ${m.content || '(sem texto)'} | Auto: ${m.isAutomated || false}`);
    }

    // Checando conversas
    const convs = await db.query.conversations.findMany({
      where: eq(conversations.contactId, contact.id)
    });
    for (const cv of convs) {
      console.log(`Conversa ID: ${cv.id} | Status: ${cv.status} | Updated: ${cv.updatedAt}`);
    }
    
    // Checando automationExecutions (se existir no schema)
    try {
      const execs = await db.query.automationExecutions.findMany({
        where: and(
          eq(automationExecutions.contactId, contact.id),
          gte(automationExecutions.startedAt, today)
        ),
        orderBy: [desc(automationExecutions.startedAt)]
      });
      console.log(`Total de automações executadas hoje: ${execs.length}`);
      for (const ex of execs) {
         console.log(`[${ex.startedAt}] FlowID: ${ex.flowId} | Status: ${ex.status}`);
      }
    } catch(e) {
       console.log("Tabela automationExecutions pode não existir ou campo diferente.");
    }
  }

  process.exit(0);
}

check().catch(console.error);
