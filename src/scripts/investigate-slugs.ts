
import 'dotenv/config';
import { db } from '@/lib/db';
import { companies } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';

async function investigateSlugs() {
    const SLUG_A = '70744aca-887f-4004-a6d2-f2e82881539d';
    const SLUG_B = 'f28e5adf-ce84-436b-94c5-cd3941f254b7';

    console.log('🔍 Investigando empresas com os slugs relevantes...\n');

    const companies_list = await db.select({
        id: companies.id,
        name: companies.name,
        slug: companies.webhookSlug,
        createdAt: companies.createdAt,
    })
        .from(companies)
        .where(or(
            eq(companies.webhookSlug, SLUG_A),
            eq(companies.webhookSlug, SLUG_B)
        ));

    if (companies_list.length === 0) {
        console.log('❌ Nenhuma empresa encontrada com esses slugs.');
    } else {
        console.log(`📋 Empresas encontradas: ${companies_list.length}\n`);
        companies_list.forEach((c, i) => {
            console.log(`--- Empresa ${i + 1} ---`);
            console.log(`ID: ${c.id}`);
            console.log(`Nome: ${c.name}`);
            console.log(`Slug: ${c.slug}`);
            console.log(`Criada em: ${c.createdAt?.toISOString()}`);
            console.log('');
        });
    }

    process.exit(0);
}

investigateSlugs();
