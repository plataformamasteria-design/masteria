/**
 * Script para remover contato de teste do banco de dados
 * Remove: contact, conversations, messages, kanban leads, scheduled meetings
 */

import { db } from '@/lib/db';
import { contacts, conversations, messages, kanbanLeads, aiScheduledMeetings } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';

const PHONE_NUMBERS = [
    '+5564999526870',
    '+556499526870',
    '5564999526870',
    '556499526870',
    '64999526870'
];

async function cleanTestContact() {
    console.log('🧹 Limpando contato de teste do banco de dados...\n');

    try {
        // 1. Buscar contato
        console.log('1️⃣ Buscando contato...');
        const contactsFound = await db.select()
            .from(contacts)
            .where(
                or(
                    eq(contacts.phone, PHONE_NUMBERS[0]),
                    eq(contacts.phone, PHONE_NUMBERS[1]),
                    eq(contacts.phone, PHONE_NUMBERS[2]),
                    eq(contacts.phone, PHONE_NUMBERS[3]),
                    eq(contacts.phone, PHONE_NUMBERS[4])
                )
            );

        if (contactsFound.length === 0) {
            console.log('   ℹ️ Nenhum contato encontrado com esses números.');
            return;
        }

        const contact = contactsFound[0];
        console.log(`   ✅ Contato encontrado: ${contact.name} (${contact.id})`);
        console.log(`      Telefone: ${contact.phone}`);

        // 2. Buscar conversas relacionadas
        console.log('\n2️⃣ Buscando conversas...');
        const convs = await db.select()
            .from(conversations)
            .where(eq(conversations.contactId, contact.id));
        console.log(`   📊 ${convs.length} conversa(s) encontrada(s)`);

        // 3. Remover mensagens
        if (convs.length > 0) {
            console.log('\n3️⃣ Removendo mensagens...');
            for (const conv of convs) {
                const deleted = await db.delete(messages)
                    .where(eq(messages.conversationId, conv.id));
                console.log(`   🗑️ Conversa ${conv.id}: mensagens removidas`);
            }
        }

        // 4. Remover leads do Kanban
        console.log('\n4️⃣ Removendo leads do Kanban...');
        const leadsDeleted = await db.delete(kanbanLeads)
            .where(eq(kanbanLeads.contactId, contact.id));
        console.log(`   🗑️ Leads removidos`);

        // 5. Remover reuniões agendadas
        console.log('\n5️⃣ Removendo reuniões agendadas...');
        const meetingsDeleted = await db.delete(aiScheduledMeetings)
            .where(eq(aiScheduledMeetings.contactId, contact.id));
        console.log(`   🗑️ Reuniões removidas`);

        // 6. Remover conversas
        if (convs.length > 0) {
            console.log('\n6️⃣ Removendo conversas...');
            for (const conv of convs) {
                await db.delete(conversations)
                    .where(eq(conversations.id, conv.id));
            }
            console.log(`   🗑️ ${convs.length} conversa(s) removida(s)`);
        }

        // 7. Remover contato
        console.log('\n7️⃣ Removendo contato...');
        await db.delete(contacts)
            .where(eq(contacts.id, contact.id));
        console.log(`   ✅ Contato ${contact.name} completamente removido!`);

        console.log('\n✅ Limpeza concluída! O número agora pode ser usado como novo contato.');

    } catch (error) {
        console.error('\n❌ Erro durante limpeza:', error);
        throw error;
    }
}

cleanTestContact()
    .then(() => {
        console.log('\n🎯 Pronto para testes!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Falha:', error);
        process.exit(1);
    });
