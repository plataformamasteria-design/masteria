
import { db } from '../lib/db';
import { contacts } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function findContact() {
    const igsid = "1896097054661185";
    try {
        console.log(`🔍 Buscando contato ig:${igsid}...`);
        const results = await db.select().from(contacts).where(eq(contacts.externalId, igsid));

        if (results.length > 0) {
            console.log(`✅ Encontrado(s) ${results.length} contato(s):`);
            results.forEach(c => {
                console.log(`   - ID: ${c.id}`);
                console.log(`   - Nome: ${c.name}`);
                console.log(`   - External ID: ${c.externalId}`);
                console.log(`   - Avatar: ${c.avatarUrl ? 'SIM' : 'NÃO'}`);
                console.log(`   - Criado em: ${c.createdAt}`);
            });
        } else {
            console.log("❌ Contato não encontrado.");
        }
    } catch (e) {
        console.error("Erro na busca:", e);
    }
}

findContact();
