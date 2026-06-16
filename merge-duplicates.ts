import { db } from './src/lib/db/index.js';
import { contacts, conversations, messages } from './src/lib/db/schema.js';
import { eq, and } from 'drizzle-orm';

async function mergeDuplicates() {
  const allContacts = await db.select({
    id: contacts.id,
    phone: contacts.phone,
    name: contacts.name,
    companyId: contacts.companyId,
    createdAt: contacts.createdAt
  }).from(contacts);

  const grouped = new Map<string, typeof allContacts>();

  for (const c of allContacts) {
    if (!c.phone) continue;
    
    let basePhone = c.phone.replace(/[^0-9]/g, ''); // strip '+' and anything else
    
    // Normalize any brazil phone to its 8-digit base
    if (basePhone.startsWith('55') && basePhone.length >= 12 && basePhone.length <= 14) {
      const ddd = basePhone.substring(2, 4);
      const rest = basePhone.substring(4);
      
      if (rest.length === 9 && rest.startsWith('9')) {
        basePhone = `55${ddd}${rest.substring(1)}`;
      } else if (rest.length === 8) {
        basePhone = `55${ddd}${rest}`;
      } else {
        if (rest.length === 9) {
           basePhone = `55${ddd}${rest.substring(1)}`;
        }
      }
    }

    const key = `${c.companyId}_${basePhone}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(c);
  }

  const duplicates = [];
  for (const [key, group] of grouped.entries()) {
    if (group.length > 1) {
      duplicates.push(group);
    }
  }

  console.log(`Encontrados ${duplicates.length} grupos de duplicatas.`);
  let mergedCount = 0;

  for (const group of duplicates) {
    // Preferência pelo contato que não tenha '+' no número, pois é o formato padrão da Evolution
    // Se nenhum ou ambos tiverem, pega o mais antigo
    group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    let primary = group.find(c => !c.phone.includes('+')) || group[0];
    
    for (const dup of group) {
      if (dup.id === primary.id) continue;

      console.log(`Mesclando: [${dup.phone}] -> [${primary.phone}] na Empresa: ${primary.companyId}`);

      try {
          await db.transaction(async (tx) => {
            const dupConversations = await tx.select().from(conversations).where(eq(conversations.contactId, dup.id));
            
            for (const conv of dupConversations) {
               // Encontra conversa primaria se existir
               const existingPrimaryConvArray = await tx.select().from(conversations).where(and(eq(conversations.contactId, primary.id), eq(conversations.companyId, primary.companyId)));
               
               if (existingPrimaryConvArray.length > 0) {
                  const primaryConvId = existingPrimaryConvArray[0].id;
                  // Move as mensagens da conversa duplicada para a principal
                  await tx.update(messages).set({ conversationId: primaryConvId }).where(eq(messages.conversationId, conv.id));
                  // Deleta a conversa duplicada
                  await tx.delete(conversations).where(eq(conversations.id, conv.id));
               } else {
                  // Se não tem conversa primária, apenas reatribui o contato
                  await tx.update(conversations).set({ contactId: primary.id }).where(eq(conversations.id, conv.id));
               }
            }
            
            // Remove o contato duplicado
            await tx.delete(contacts).where(eq(contacts.id, dup.id));
          });
          mergedCount++;
      } catch (e) {
          console.error(`Erro ao mesclar ${dup.id} para ${primary.id}:`, e);
      }
    }
  }
  
  console.log(`Unificação completa! ${mergedCount} contatos secundários foram mesclados e removidos.`);
  process.exit(0);
}

mergeDuplicates().catch(console.error);
