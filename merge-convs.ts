import { db } from './src/lib/db/index.js';
import { conversations, messages } from './src/lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function mergeConversations() {
  console.log('Buscando conversas duplicadas por contato...');
  
  // Obter todas as conversas
  const allConvs = await db.select().from(conversations);
  
  const grouped = new Map<string, typeof allConvs>();
  for (const conv of allConvs) {
    if (!conv.contactId) continue;
    if (!grouped.has(conv.contactId)) {
      grouped.set(conv.contactId, []);
    }
    grouped.get(conv.contactId)!.push(conv);
  }

  const duplicates = [];
  for (const [contactId, group] of grouped.entries()) {
    if (group.length > 1) {
      duplicates.push({ contactId, convs: group });
    }
  }

  console.log(`Encontrados ${duplicates.length} contatos com múltiplas conversas.`);

  let mergedCount = 0;

  for (const dup of duplicates) {
    // Sort conversations by updatedAt desc so the most recent/active is the primary
    dup.convs.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });
    
    const primary = dup.convs[0];
    const secondaries = dup.convs.slice(1);

    for (const sec of secondaries) {
      console.log(`Mesclando conversa ${sec.id} para ${primary.id} (Contato: ${dup.contactId})`);
      
      try {
        await db.transaction(async (tx) => {
          // Move messages to the primary conversation
          await tx.update(messages)
            .set({ conversationId: primary.id })
            .where(eq(messages.conversationId, sec.id));
            
          // Delete the secondary/ghost conversation
          await tx.delete(conversations).where(eq(conversations.id, sec.id));
        });
        mergedCount++;
      } catch (err) {
        console.error(`Erro ao mesclar conversa ${sec.id}:`, err);
      }
    }
  }

  console.log(`Unificação completa! ${mergedCount} conversas fantasmas foram mescladas e removidas.`);
  process.exit(0);
}

mergeConversations().catch(console.error);
