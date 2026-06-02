import { db } from '@/db';
import { contacts, contactLists, contactListSubscribers } from '@/db/schema';
import { eq, inArray, or, like } from 'drizzle-orm';

async function main() {
    console.log("=== INICIANDO LIMPEZA DE BANCO ===");
    
    const targetPhone = '5588920008007';

    try {
        // 1. Achar o contato
        const leads = await db.select().from(contacts).where(eq(contacts.phone, targetPhone));
        for (const lead of leads) {
            console.log(`Deletando inscricoes da lista do contato ${lead.id}...`);
            await db.delete(contactListSubscribers).where(eq(contactListSubscribers.contactId, lead.id));
            console.log(`Deletando contato ${lead.id}...`);
            await db.delete(contacts).where(eq(contacts.id, lead.id));
        }

        // 2. Deletar listas de teste
        const lists = await db.select().from(contactLists).where(
            or(
                like(contactLists.name, '%API Oficial%'),
                like(contactLists.name, '%Teste%')
            )
        );

        for (const list of lists) {
            console.log(`Deletando inscricoes da lista ${list.id}...`);
            await db.delete(contactListSubscribers).where(eq(contactListSubscribers.listId, list.id));
            console.log(`Deletando lista ${list.name}...`);
            await db.delete(contactLists).where(eq(contactLists.id, list.id));
        }

        console.log("Limpeza concluída com sucesso.");
    } catch(e) {
        console.error("Erro na limpeza", e);
    }
}

main().catch(console.error).finally(() => process.exit(0));
