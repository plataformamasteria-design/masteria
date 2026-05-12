import { db } from './src/lib/db';
import { contacts, contactLists, contactsToContactLists } from './src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const companyId = 'aca8c096-cf39-49a5-957a-2819b74ab2ab';
  console.log(`Buscando contatos da empresa: ${companyId}...`);
  
  // 1. Get contacts
  const companyContacts = await db.select().from(contacts).where(eq(contacts.companyId, companyId));
  console.log(`Encontrados ${companyContacts.length} contatos.`);
  
  if (companyContacts.length === 0) {
    console.log("Nenhum contato para vincular à lista. Apenas criando a lista vazia.");
  }

  // 2. Find or create the list
  const listName = 'Todos os Contatos';
  let listId = '';
  
  const existingList = await db.select().from(contactLists).where(and(eq(contactLists.companyId, companyId), eq(contactLists.name, listName)));
  
  if (existingList.length > 0) {
    console.log(`Lista '${listName}' já existe. Usando ID: ${existingList[0].id}`);
    listId = existingList[0].id;
  } else {
    console.log(`Criando nova lista '${listName}'...`);
    const newList = await db.insert(contactLists).values({
      companyId: companyId,
      name: listName,
      description: 'Lista automática com todos os contatos da organização',
    }).returning({ id: contactLists.id });
    
    listId = newList[0].id;
    console.log(`Lista criada com ID: ${listId}`);
  }

  if (companyContacts.length > 0) {
    // 3. Add contacts to the list
    console.log('Adicionando contatos à lista...');
    const insertData = companyContacts.map(c => ({
      companyId: companyId,
      contactId: c.id,
      listId: listId
    }));

    // insert in batches of 1000 to prevent query too large
    const batchSize = 1000;
    let inserted = 0;
    for (let i = 0; i < insertData.length; i += batchSize) {
      const batch = insertData.slice(i, i + batchSize);
      await db.insert(contactsToContactLists).values(batch).onConflictDoNothing();
      inserted += batch.length;
      console.log(`Lote inserido: ${inserted}/${insertData.length}`);
    }
  }

  console.log('Finalizado com sucesso!');
  process.exit(0);
}

run().catch(console.error);
