
import { db } from '../lib/db';
import { contacts, connections } from '../lib/db/schema';
import { eq, and, like } from 'drizzle-orm';
import { decrypt } from '../lib/crypto';
import { getInstagramUserProfile } from '../lib/facebookApiService';

async function fixGenericProfiles() {
    try {
        console.log("🔍 Buscando contatos com nomes genéricos...");
        const genericContacts = await db.select()
            .from(contacts)
            .where(and(
                eq(contacts.externalProvider, 'instagram'),
                like(contacts.name, 'Instagram User %')
            ));

        console.log(`✅ Encontrados ${genericContacts.length} contatos para corrigir.`);

        for (const contact of genericContacts) {
            console.log(`\n👤 Processando: ${contact.name} (${contact.externalId})`);

            // Buscar conexão para esta empresa
            const [connection] = await db.select()
                .from(connections)
                .where(and(
                    eq(connections.companyId, contact.companyId!),
                    eq(connections.connectionType, 'instagram'),
                    eq(connections.isActive, true)
                ))
                .limit(1);

            if (!connection || !connection.accessToken) {
                console.log(`   ⚠️ Conexão ativa não encontrada para a empresa ${contact.companyId}`);
                continue;
            }

            try {
                const accessToken = decrypt(connection.accessToken);
                if (!accessToken) throw new Error("Falha na decriptação");

                const profile = await getInstagramUserProfile(contact.externalId!, accessToken);
                if (profile && !profile.name.startsWith('Instagram User ')) {
                    await db.update(contacts)
                        .set({
                            name: profile.name,
                            whatsappName: profile.name,
                            avatarUrl: profile.profile_pic || contact.avatarUrl
                        })
                        .where(eq(contacts.id, contact.id));
                    console.log(`   ✨ Sucesso! Nome atualizado para: ${profile.name}`);
                } else {
                    console.log(`   ℹ️ API não retornou nome real (ou é o mesmo).`);
                }
            } catch (e: any) {
                console.error(`   ❌ Erro ao processar ${contact.name}: ${e.message}`);
            }
        }

        console.log("\n🚀 Concluído!");
    } catch (e) {
        console.error("Erro no script de correção:", e);
    }
}

fixGenericProfiles();
