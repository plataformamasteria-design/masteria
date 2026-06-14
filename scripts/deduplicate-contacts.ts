import 'dotenv/config';
import { db } from '../src/lib/db';
import { contacts, conversations, messages } from '../src/lib/db/schema';
import { eq, inArray, and, isNotNull } from 'drizzle-orm';
import { getPhoneVariations, canonicalizeBrazilPhone } from '../src/lib/utils';

async function runDeduplication() {
  console.log('Iniciando script de desduplicação de contatos...');

  try {
    const allContacts = await db.select().from(contacts);
    console.log(`Encontrados ${allContacts.length} contatos totais no banco de dados.`);

    const companyToPhoneGroups: Record<string, Record<string, typeof allContacts>> = {};

    for (const contact of allContacts) {
      if (!contact.phone) continue;
      
      const canonical = canonicalizeBrazilPhone(contact.phone);
      if (!canonical) continue;

      if (!companyToPhoneGroups[contact.companyId]) {
        companyToPhoneGroups[contact.companyId] = {};
      }

      if (!companyToPhoneGroups[contact.companyId][canonical]) {
        companyToPhoneGroups[contact.companyId][canonical] = [];
      }

      companyToPhoneGroups[contact.companyId][canonical].push(contact);
    }

    let mergedCount = 0;
    let deletedCount = 0;

    for (const [companyId, phoneGroups] of Object.entries(companyToPhoneGroups)) {
      for (const [canonicalPhone, group] of Object.entries(phoneGroups)) {
        if (group.length > 1) {
          console.log(`\n[Company ${companyId}] Encontrado grupo duplicado para ${canonicalPhone}: ${group.map(c => c.id).join(', ')}`);

          // Determinar o "Master Contact" (preferência para aquele que já possui conexões/mensagens, ou o mais antigo)
          const sortedGroup = group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          const masterContact = sortedGroup[0];
          const duplicateContacts = sortedGroup.slice(1);
          const duplicateIds = duplicateContacts.map(c => c.id);

          console.log(`- Master: ${masterContact.id} (${masterContact.phone})`);
          console.log(`- Duplicatas a mesclar: ${duplicateIds.join(', ')}`);

          // 1. Encontrar todas as conversas das duplicatas
          const duplicateConversations = await db.select().from(conversations).where(inArray(conversations.contactId, duplicateIds));
          
          if (duplicateConversations.length > 0) {
            console.log(`  - Encontradas ${duplicateConversations.length} conversas nas duplicatas para reatribuir.`);
            
            // Para cada conversa duplicada, checar se já existe uma conversa do Master Contact para a mesma connectionId
            for (const dupConv of duplicateConversations) {
              const [masterConv] = await db.select().from(conversations).where(and(
                eq(conversations.contactId, masterContact.id),
                eq(conversations.connectionId, dupConv.connectionId)
              ));

              if (masterConv) {
                // Já existe uma conversa para esta conexão no Master Contact.
                // Mover todas as mensagens da dupConv para a masterConv
                const movedMessages = await db.update(messages)
                  .set({ conversationId: masterConv.id })
                  .where(eq(messages.conversationId, dupConv.id))
                  .returning({ id: messages.id });
                
                console.log(`    - Movidas ${movedMessages.length} mensagens para a conversa master existente ${masterConv.id}`);

                // Deletar a conversa duplicada
                await db.delete(conversations).where(eq(conversations.id, dupConv.id));
              } else {
                // Não existe conversa master para esta conexão, podemos simplesmente apontar a conversa duplicada para o Master Contact
                await db.update(conversations)
                  .set({ contactId: masterContact.id })
                  .where(eq(conversations.id, dupConv.id));
                console.log(`    - Conversa ${dupConv.id} reatribuída ao master contact ${masterContact.id}`);
              }
            }
          }

          // Atualizar mensagens com contactId = null se houver lógica no banco
          // Mas na nossa estrutura, messages apontam para conversationId. 
          
          // Melhorar informações do Master Contact se faltar algo (ex: avatar, nome)
          const updatePayload: any = {};
          if (!masterContact.avatarUrl && duplicateContacts.some(c => c.avatarUrl)) {
            updatePayload.avatarUrl = duplicateContacts.find(c => c.avatarUrl)!.avatarUrl;
          }
          const genericMasterName = /^\d+$/.test(masterContact.name.replace(/\D/g, ''));
          if (genericMasterName || masterContact.name === 'Contato') {
            const betterContact = duplicateContacts.find(c => {
               const isGeneric = /^\d+$/.test(c.name.replace(/\D/g, ''));
               return !isGeneric && c.name !== 'Contato';
            });
            if (betterContact) {
               updatePayload.name = betterContact.name;
            }
          }
          if (Object.keys(updatePayload).length > 0) {
              await db.update(contacts).set(updatePayload).where(eq(contacts.id, masterContact.id));
              console.log(`  - Master contact info atualizado:`, updatePayload);
          }

          // 2. Apagar os contatos duplicados
          const deleteResult = await db.delete(contacts).where(inArray(contacts.id, duplicateIds)).returning({ id: contacts.id });
          console.log(`  - Deletados ${deleteResult.length} contatos duplicados.`);

          mergedCount++;
          deletedCount += duplicateIds.length;
        }
      }
    }

    console.log(`\nDesduplicação concluída!`);
    console.log(`Grupos mesclados: ${mergedCount}`);
    console.log(`Contatos deletados: ${deletedCount}`);

  } catch (error) {
    console.error('Erro ao desduplicar contatos:', error);
  } finally {
    process.exit(0);
  }
}

runDeduplication();
