import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../src/lib/db/index.js';
import { contacts, conversations, messages, whatsappDeliveryReports, kanbanLeads, contactsToTags } from '../src/lib/db/schema.js';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';

/**
 * Script para unificar contatos que foram duplicados devido à adição do 9º dígito.
 * O script varre todos os contatos agrupando por variação de telefone.
 * Mantém o contato que possui a última mensagem ou a conversa mais ativa, e migra os dados dos demais para ele.
 */

async function deduplicateContacts() {
    console.log("🔍 Iniciando análise de contatos duplicados...");

    // Pega todos os contatos que possuem números no formato brasileiro celular (com ou sem 9)
    // Agrupa pelos 8 ultimos digitos (descartando o 9) + DDD
    const allContacts = await db.select({
        id: contacts.id,
        phone: contacts.phone,
        companyId: contacts.companyId,
    }).from(contacts);

    const groups = new Map<string, typeof allContacts>();

    for (const contact of allContacts) {
        if (!contact.phone) continue;
        
        let normalized = contact.phone.replace(/\D/g, '');
        if (normalized.startsWith('55') && normalized.length >= 12) {
            const ddd = normalized.substring(2, 4);
            const body = normalized.substring(4);
            let coreNumber = body;
            if (body.length === 9 && body.startsWith('9')) {
                coreNumber = body.substring(1);
            }
            
            const groupKey = `${contact.companyId}-55${ddd}${coreNumber}`;
            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey)!.push(contact);
        }
    }

    let mergedCount = 0;

    for (const [key, group] of Array.from(groups.entries())) {
        if (group.length > 1) {
            console.log(`\n⚠️ Encontrada duplicação para chave ${key}: ${group.map(c => c.phone).join(', ')}`);
            
            // Decidir qual contato manter. Prioridade: 
            // 1. Tem conversas com mais mensagens
            // 2. Foi atualizado mais recentemente
            
            const contactScores = await Promise.all(group.map(async (c) => {
                const convos = await db.select({ id: conversations.id, lastAt: conversations.lastMessageAt })
                                      .from(conversations)
                                      .where(eq(conversations.contactId, c.id));
                const totalConvos = convos.length;
                let lastActivity = new Date(0);
                
                for (const conv of convos) {
                    if (conv.lastAt && conv.lastAt > lastActivity) {
                        lastActivity = conv.lastAt;
                    }
                }
                
                return { contact: c, totalConvos, lastActivity: lastActivity.getTime() };
            }));

            // Ordena decrescente por atividade
            contactScores.sort((a, b) => b.lastActivity - a.lastActivity || b.totalConvos - a.totalConvos);
            
            const keepContact = contactScores[0].contact;
            const duplicateContacts = contactScores.slice(1).map(c => c.contact);

            console.log(`✅ Mantendo contato: ${keepContact.phone} (ID: ${keepContact.id})`);

            for (const dup of duplicateContacts) {
                console.log(`🔄 Migrando dados de: ${dup.phone} (ID: ${dup.id}) para ${keepContact.id}`);

                await db.transaction(async (tx) => {
                    // 1. Migrar conversas
                    // Atenção: Se ambos tiverem conversa com a mesma conexão, precisamos mesclar as mensagens!
                    const dupConvos = await tx.select().from(conversations).where(eq(conversations.contactId, dup.id));
                    
                    for (const dupConvo of dupConvos) {
                        if (!dupConvo.connectionId) continue;
                        
                        const [existingConvo] = await tx.select().from(conversations).where(and(
                            eq(conversations.contactId, keepContact.id),
                            eq(conversations.connectionId, dupConvo.connectionId)
                        ));

                        if (existingConvo) {
                            // Mesclar mensagens para a conversa existente
                            await tx.update(messages)
                                .set({ conversationId: existingConvo.id })
                                .where(eq(messages.conversationId, dupConvo.id));
                                
                            // Apagar conversa duplicada vazia
                            await tx.delete(conversations).where(eq(conversations.id, dupConvo.id));
                            
                            // Atualizar lastMessageAt se necessário
                            if (dupConvo.lastMessageAt && (!existingConvo.lastMessageAt || dupConvo.lastMessageAt > existingConvo.lastMessageAt)) {
                                await tx.update(conversations).set({ lastMessageAt: dupConvo.lastMessageAt }).where(eq(conversations.id, existingConvo.id));
                            }
                        } else {
                            // Apenas reatribuir o contato da conversa
                            await tx.update(conversations)
                                .set({ contactId: keepContact.id })
                                .where(eq(conversations.id, dupConvo.id));
                        }
                    }

                    // 2. Migrar relatórios de entrega
                    await tx.update(whatsappDeliveryReports)
                        .set({ contactId: keepContact.id })
                        .where(eq(whatsappDeliveryReports.contactId, dup.id));

                    // 3. Migrar kanban (ignorar duplicados violando restrições únicas)
                    const dupKanbans = await tx.select().from(kanbanLeads).where(eq(kanbanLeads.contactId, dup.id));
                    for (const kb of dupKanbans) {
                        try {
                            await tx.update(kanbanLeads).set({ contactId: keepContact.id }).where(eq(kanbanLeads.id, kb.id));
                        } catch (e) {
                            // Se já existir no kanban, apaga o do contato duplicado
                            await tx.delete(kanbanLeads).where(eq(kanbanLeads.id, kb.id));
                        }
                    }

                    // 4. Migrar tags (ignorar se já existir)
                    const dupTags = await tx.select().from(contactsToTags).where(eq(contactsToTags.contactId, dup.id));
                    for (const dt of dupTags) {
                        try {
                            await tx.update(contactsToTags).set({ contactId: keepContact.id }).where(and(
                                eq(contactsToTags.contactId, dup.id),
                                eq(contactsToTags.tagId, dt.tagId)
                            ));
                        } catch (e) {
                            await tx.delete(contactsToTags).where(and(
                                eq(contactsToTags.contactId, dup.id),
                                eq(contactsToTags.tagId, dt.tagId)
                            ));
                        }
                    }

                    // 5. Apagar contato duplicado
                    await tx.delete(contacts).where(eq(contacts.id, dup.id));
                });
                
                mergedCount++;
            }
        }
    }

    console.log(`\n🎉 Processo concluído! ${mergedCount} contatos duplicados foram mesclados e removidos.`);
}

deduplicateContacts().catch(console.error).then(() => process.exit(0));
