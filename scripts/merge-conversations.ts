import 'dotenv/config';
import { db } from '../src/lib/db';
import { conversations, messages, automationLogs } from '../src/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function mergeConversations() {
  console.log('Iniciando fusão de conversas duplicadas (mesmo contactId)...');

  try {
    const allConversations = await db.select().from(conversations);
    
    // Group by contactId + connectionId
    // We will group by contactId, then by connectionId. 
    // All null connectionIds for a contact will be placed in a special 'null' bucket to be merged into the first available valid connection bucket.
    const contactConvs: Record<string, typeof allConversations> = {};
    for (const conv of allConversations) {
      if (!contactConvs[conv.contactId]) {
        contactConvs[conv.contactId] = [];
      }
      contactConvs[conv.contactId].push(conv);
    }

    let mergedGroups = 0;
    let deletedConvs = 0;

    for (const [contactId, convs] of Object.entries(contactConvs)) {
      // Group by connectionId within the contact
      const connectionGroups: Record<string, typeof allConversations> = {};
      const nullConvs: typeof allConversations = [];

      for (const conv of convs) {
          if (conv.connectionId === null) {
              nullConvs.push(conv);
          } else {
              if (!connectionGroups[conv.connectionId]) connectionGroups[conv.connectionId] = [];
              connectionGroups[conv.connectionId].push(conv);
          }
      }

      // Se não houver nenhum connectionId válido, agrupa todos os null juntos
      if (Object.keys(connectionGroups).length === 0 && nullConvs.length > 0) {
          connectionGroups['null_fallback'] = nullConvs;
      } else if (nullConvs.length > 0) {
          // Se houver connectionIds válidos, pega o primeiro e joga os nulls lá para serem mesclados
          const firstValidConn = Object.keys(connectionGroups)[0];
          connectionGroups[firstValidConn].push(...nullConvs);
      }

      for (const [connId, groupConvs] of Object.entries(connectionGroups)) {
          if (groupConvs.length > 1) {
            console.log(`\n[Contato ${contactId} | Conn ${connId}] Encontrado grupo de ${groupConvs.length} conversas.`);
            
            // Determinar a "Master Conversation"
            const sortedConvs = groupConvs.sort((a, b) => {
               const aHasConn = a.connectionId !== null ? 1 : 0;
           const bHasConn = b.connectionId !== null ? 1 : 0;
           if (aHasConn !== bHasConn) return bHasConn - aHasConn;
           
           const statusRank: Record<string, number> = {
              'IN_PROGRESS': 5, 'OPEN': 4, 'NEW': 3, 'CLOSED': 2, 'ARCHIVED': 1
           };
           const aRank = statusRank[a.status] || 0;
           const bRank = statusRank[b.status] || 0;
           if (aRank !== bRank) return bRank - aRank;

           return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        });

        const masterConv = sortedConvs[0];
        const duplicates = sortedConvs.slice(1);
        const duplicateIds = duplicates.map(c => c.id);

        console.log(`  - Master Conv: ${masterConv.id} (Status: ${masterConv.status}, Conn: ${masterConv.connectionId})`);
        console.log(`  - Duplicatas a mesclar: ${duplicateIds.join(', ')}`);

        // Transferir mensagens para a master
        const movedMessages = await db.update(messages)
            .set({ conversationId: masterConv.id })
            .where(inArray(messages.conversationId, duplicateIds))
            .returning({ id: messages.id });
            
        if (movedMessages.length > 0) {
            console.log(`    - Movidas ${movedMessages.length} mensagens para a master conv.`);
        }

        // Transferir logs de automação
        const movedLogs = await db.update(automationLogs)
            .set({ conversationId: masterConv.id })
            .where(inArray(automationLogs.conversationId, duplicateIds))
            .returning({ id: automationLogs.id });

        if (movedLogs.length > 0) {
            console.log(`    - Movidos ${movedLogs.length} logs de automação para a master conv.`);
        }

        // Deletar as conversas duplicadas
        const deleteResult = await db.delete(conversations)
            .where(inArray(conversations.id, duplicateIds))
            .returning({ id: conversations.id });
            
        console.log(`    - Deletadas ${deleteResult.length} conversas duplicadas.`);

        mergedGroups++;
        deletedConvs += duplicateIds.length;
          }
      }
    }

    console.log(`\nFusão de conversas concluída!`);
    console.log(`Grupos mesclados: ${mergedGroups}`);
    console.log(`Conversas duplicadas deletadas: ${deletedConvs}`);

  } catch (error) {
    console.error('Erro durante a fusão de conversas:', error);
  } finally {
    process.exit(0);
  }
}

mergeConversations();
