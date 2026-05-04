
import 'dotenv/config';
import { db } from '@/lib/db';
import { companies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function fixWebhookSlug() {
    const OLD_SLUG = '70744aca-887f-4004-a6d2-f2e82881539d';
    const NEW_SLUG = 'f28e5adf-ce84-436b-94c5-cd3941f254b7';

    console.log('🔧 Corrigindo webhookSlug...');
    console.log(`   OLD: ${OLD_SLUG}`);
    console.log(`   NEW: ${NEW_SLUG}`);

    // Find company with old slug
    const [company] = await db.select({
        id: companies.id,
        name: companies.name,
        slug: companies.webhookSlug,
    })
        .from(companies)
        .where(eq(companies.webhookSlug, OLD_SLUG))
        .limit(1);

    if (!company) {
        console.log('⚠️ Nenhuma empresa com o slug antigo encontrada. Verificando se já foi atualizado...');

        const [existing] = await db.select({
            id: companies.id,
            name: companies.name,
            slug: companies.webhookSlug,
        })
            .from(companies)
            .where(eq(companies.webhookSlug, NEW_SLUG))
            .limit(1);

        if (existing) {
            console.log(`✅ Empresa "${existing.name}" já possui o slug correto: ${existing.slug}`);
        } else {
            console.log('❌ Nenhuma empresa encontrada com nenhum dos slugs. Verifique a configuração.');
        }
        process.exit(0);
        return;
    }

    console.log(`\n📋 Empresa encontrada: "${company.name}" (ID: ${company.id})`);

    // Update slug
    await db.update(companies)
        .set({ webhookSlug: NEW_SLUG })
        .where(eq(companies.id, company.id));

    console.log('✅ Slug atualizado com sucesso!');

    // Verify
    const [updated] = await db.select({
        slug: companies.webhookSlug,
    })
        .from(companies)
        .where(eq(companies.id, company.id))
        .limit(1);

    console.log(`\n🔍 Verificação: webhookSlug atual = ${updated?.slug}`);

    if (updated?.slug === NEW_SLUG) {
        console.log('✅ SUCESSO: Slug alinhado com Meta App Dashboard.');
    } else {
        console.log('❌ ERRO: Slug não foi atualizado corretamente.');
    }

    process.exit(0);
}

fixWebhookSlug();
