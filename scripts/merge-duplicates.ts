import { db } from '../src/lib/db';
import {
  contacts,
  kanbanLeads,
  conversations,
  messages,
  contactsToTags,
  contactsToContactLists,
  automationFlowExecutions,
  aiScheduledMeetings
} from '../src/lib/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { normalizeBrazilianSMS } from '../src/lib/utils/phone';

async function main() {
  console.log('Iniciando script de mesclagem de contatos duplicados...');
  const allContacts = await db.select().from(contacts);
  console.log(`Total de contatos encontrados: ${allContacts.length}`);

  // Agrupar contatos
  const normalizedMap: Record<string, typeof allContacts> = {};

  for (const c of allContacts) {
    if (!c.phone) continue;
    const norm = normalizeBrazilianSMS(c.phone);
    const keyPhone = norm.valid ? norm.number : c.phone.replace(/\D/g, '');
    const key = `${c.companyId}_${keyPhone}`;

    if (!normalizedMap[key]) {
      normalizedMap[key] = [];
    }
    normalizedMap[key].push(c);
  }

  let mergedGroups = 0;

  for (const [key, group] of Object.entries(normalizedMap)) {
    if (group.length > 1) {
      mergedGroups++;
      // Sort by createdAt ASC (oldest first)
      group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const primary = group[0];
      const secondaries = group.slice(1);
      const secondaryIds = secondaries.map(c => c.id);

      console.log(`\n🔹 Mesclando grupo: ${key.split('_')[1]}`);
      console.log(`  Principal mantido: ${primary.id} (Criado em ${primary.createdAt})`);
      console.log(`  Secundários a serem mesclados e deletados: ${secondaryIds.join(', ')}`);

      // 1. Mesclar Custom Fields
      let mergedCustomFields = { ...(primary.customFields as Record<string, string> || {}) };
      for (const sec of secondaries) {
        if (sec.customFields && typeof sec.customFields === 'object') {
          mergedCustomFields = { ...mergedCustomFields, ...(sec.customFields as Record<string, string>) };
        }
      }

      // Atualizar Primary com os campos combinados
      if (Object.keys(mergedCustomFields).length > 0) {
        await db.update(contacts)
          .set({ customFields: mergedCustomFields })
          .where(eq(contacts.id, primary.id));
      }

      // 2. Tratar Conversas e Mensagens
      // Para cada secundário, buscar suas conversas
      for (const sec of secondaries) {
        const secConvs = await db.select().from(conversations).where(eq(conversations.contactId, sec.id));
        for (const sConv of secConvs) {
          // Checar se o principal já tem conversa na MESMA connectionId
          if (!sConv.connectionId) continue;
          
          const [pConv] = await db.select().from(conversations).where(and(
            eq(conversations.contactId, primary.id),
            eq(conversations.connectionId, sConv.connectionId)
          )).limit(1);

          if (pConv) {
            // Principal JÁ TEM conversa -> Transferir mensagens e deletar conversa do secundário
            console.log(`    Transferindo mensagens da conversa secundária ${sConv.id} -> ${pConv.id}`);
            await db.update(messages)
              .set({ conversationId: pConv.id })
              .where(eq(messages.conversationId, sConv.id));
              
            await db.delete(conversations).where(eq(conversations.id, sConv.id));
          } else {
            // Principal NÃO TEM conversa -> Apenas atualizar o contactId da conversa secundária
            console.log(`    Transferindo conversa secundária inteira ${sConv.id} para contato principal`);
            await db.update(conversations)
              .set({ contactId: primary.id })
              .where(eq(conversations.id, sConv.id));
          }
        }
      }

      // 3. Atualizar relacionamentos diretos (1-N) sem Unique Constraints complexas
      await db.update(kanbanLeads)
        .set({ contactId: primary.id })
        .where(inArray(kanbanLeads.contactId, secondaryIds));
        
      await db.update(automationFlowExecutions)
        .set({ contactId: primary.id })
        .where(inArray(automationFlowExecutions.contactId, secondaryIds));
        
      await db.update(aiScheduledMeetings)
        .set({ contactId: primary.id })
        .where(inArray(aiScheduledMeetings.contactId, secondaryIds));

      // 4. Atualizar N-N com cuidado (Ignorar conflitos caso a tag já exista no principal)
      for (const secId of secondaryIds) {
        try {
          // ContactsToTags
          const secTags = await db.select().from(contactsToTags).where(eq(contactsToTags.contactId, secId));
          for (const t of secTags) {
            try {
              await db.insert(contactsToTags).values({
                contactId: primary.id,
                tagId: t.tagId,
                companyId: t.companyId
              }).onConflictDoNothing();
            } catch (e) {}
          }
          
          // ContactsToContactLists
          const secLists = await db.select().from(contactsToContactLists).where(eq(contactsToContactLists.contactId, secId));
          for (const l of secLists) {
            try {
              await db.insert(contactsToContactLists).values({
                contactId: primary.id,
                listId: l.listId,
                companyId: l.companyId
              }).onConflictDoNothing();
            } catch (e) {}
          }
        } catch (e) {
          console.warn(`    Aviso ao migrar tags do contato ${secId}:`, e);
        }
      }

      // 5. Deletar contatos secundários (Cascade delete cuidaria do resto, mas já migramos tudo)
      console.log(`    Deletando contatos secundários...`);
      await db.delete(contacts).where(inArray(contacts.id, secondaryIds));
      
      console.log(`  ✅ Fusão concluída com sucesso.`);
    }
  }

  console.log(`\nTotal de grupos mesclados: ${mergedGroups}`);
  console.log('Sanitização concluída.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
