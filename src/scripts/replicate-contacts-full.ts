
import { db } from '@/lib/db';
import { contacts, contactLists, contactsToContactLists, companies } from '@/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

const SOURCE_COMPANY_ID = '682b91ea-15ee-42da-8855-70309b237008'; // Diego's Company
const BATCH_SIZE = 500;

async function main() {
  console.log('Iniciando replicação COMPLETA de Contatos e Associações...');
  
  try {
    // 1. Obter empresas de destino
    const allCompanies = await db.select().from(companies);
    const targetCompanies = allCompanies.filter(c => c.id !== SOURCE_COMPANY_ID);
    console.log(`Destinos: ${targetCompanies.length} empresas encontradas.\n`);

    // 2. Mapear Listas da Fonte (Nome -> ID Original)
    const sourceLists = await db.select({ id: contactLists.id, name: contactLists.name })
      .from(contactLists)
      .where(eq(contactLists.companyId, SOURCE_COMPANY_ID));
    
    const sourceListMap = new Map(sourceLists.map(l => [l.id, l.name]));
    console.log(`Listas na fonte: ${sourceLists.length}`);

    // 3. Processar em lotes
    let offset = 0;
    let totalProcessed = 0;
    
    // eslint-disable-next-line no-constant-condition
    while (true) {
      console.log(`\nBuscando lote de contatos ${offset} a ${offset + BATCH_SIZE}...`);
      
      const batchContacts = await db.select()
        .from(contacts)
        .where(eq(contacts.companyId, SOURCE_COMPANY_ID))
        .limit(BATCH_SIZE)
        .offset(offset);

      if (batchContacts.length === 0) break;

      // Buscar associações para este lote
      const contactIds = batchContacts.map(c => c.id);
      const batchAssociations = await db.select()
        .from(contactsToContactLists)
        .where(inArray(contactsToContactLists.contactId, contactIds));

      // Mapa: ContactID Original -> Array de Nomes de Listas
      const contactListsMap = new Map<string, string[]>();
      batchAssociations.forEach(assoc => {
        const listName = sourceListMap.get(assoc.listId);
        if (listName) {
          const listNames = contactListsMap.get(assoc.contactId) || [];
          listNames.push(listName);
          contactListsMap.set(assoc.contactId, listNames);
        }
      });

      // Replicar para cada empresa de destino
      for (const target of targetCompanies) {
        console.log(`  > Replicando ${batchContacts.length} contatos para: ${target.name}`);
        
        // Mapear Listas do Destino (Nome -> ID Destino)
        const targetLists = await db.select({ id: contactLists.id, name: contactLists.name })
          .from(contactLists)
          .where(eq(contactLists.companyId, target.id));
        const targetListMap = new Map(targetLists.map(l => [l.name, l.id]));

        // Preparar inserções de contatos
        // IMPORTANTE: Drizzle não suporta upsert em massa com retorno de IDs facilmente em todos os drivers
        // Faremos inserção um a um ou em grupos menores com verificação
        
        for (const contact of batchContacts) {
          // Verificar se já existe (pelo telefone)
          let targetContactId: string;
          
          const existing = await db.select({ id: contacts.id })
            .from(contacts)
            .where(and(
              eq(contacts.companyId, target.id),
              eq(contacts.phone, contact.phone)
            ));

          if (existing.length > 0 && existing[0]) {
            targetContactId = existing[0].id;
          } else {
            const [newContact] = await db.insert(contacts).values({
              companyId: target.id,
              name: contact.name,
              phone: contact.phone,
              email: contact.email,
              whatsappName: contact.whatsappName,
              avatarUrl: contact.avatarUrl,
              isGroup: contact.isGroup,
              status: contact.status,
              notes: contact.notes,
              tags: (contact as any).tags,
              customFields: (contact as any).customFields,
              // Copiar outros campos relevantes
              addressCity: contact.addressCity,
              addressState: contact.addressState,
              createdAt: new Date(), // Resetar data
            } as any).returning({ id: contacts.id });

            if (!newContact) throw new Error('Falha ao criar contato');
            targetContactId = newContact.id;
          }

          // Criar associações com listas
          const listsToAssociate = contactListsMap.get(contact.id) || [];
          for (const listName of listsToAssociate) {
            const targetListId = targetListMap.get(listName);
            if (targetListId) {
              await db.insert(contactsToContactLists)
                .values({
                  companyId: target.id,
                  contactId: targetContactId,
                  listId: targetListId
                })
                .onConflictDoNothing()
                .catch(err => {/* Ignorar duplicatas */});
            }
          }
        }
      }

      totalProcessed += batchContacts.length;
      offset += BATCH_SIZE;
      console.log(`  Total processado: ${totalProcessed}`);
    }

    console.log('\nReplicação COMPLETA concluída com sucesso!');

  } catch (error) {
    console.error('Erro crítico na replicação:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
