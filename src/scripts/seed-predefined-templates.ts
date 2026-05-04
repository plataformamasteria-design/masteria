#!/usr/bin/env tsx

import { db } from '@/lib/db';
import { messageTemplates, companies, connections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface PredefinedTemplate {
  name: string;
  displayName: string;
  category: string;
  bodyText: string;
}

const PREDEFINED_TEMPLATES: PredefinedTemplate[] = [
  {
    name: 'boas_vindas',
    displayName: 'Boas-vindas',
    category: 'Atendimento',
    bodyText: 'Olá {{1}}! Bem-vindo(a) à {{2}}. Como podemos ajudar?',
  },
  {
    name: 'follow_up',
    displayName: 'Follow-up',
    category: 'Follow-up',
    bodyText: 'Oi {{1}}, tudo bem? Gostaria de saber se ficou com alguma dúvida sobre nossa conversa anterior.',
  },
  {
    name: 'agradecimento',
    displayName: 'Agradecimento',
    category: 'Atendimento',
    bodyText: 'Muito obrigado pelo contato, {{1}}! Entraremos em contato em breve.',
  },
  {
    name: 'confirmacao_reuniao',
    displayName: 'Confirmação reunião',
    category: 'Vendas',
    bodyText: 'Olá {{1}}, confirmando nossa reunião para {{2}}. Nos vemos lá!',
  },
  {
    name: 'proposta_comercial',
    displayName: 'Proposta comercial',
    category: 'Vendas',
    bodyText: 'Olá {{1}}, seguem os detalhes da nossa proposta comercial. Valor: R$ {{2}}.',
  },
];

async function seedPredefinedTemplates() {
  console.log('🌱 [Seed] Starting predefined templates seeding...');

  try {
    const allCompanies = await db.select().from(companies);
    
    if (allCompanies.length === 0) {
      console.warn('⚠️  [Seed] No companies found in database. Skipping template seeding.');
      return;
    }

    console.log(`📊 [Seed] Found ${allCompanies.length} companies`);

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const company of allCompanies) {
      console.log(`\n🏢 [Seed] Processing company: ${company.name} (${company.id})`);

      const companyConnections = await db
        .select()
        .from(connections)
        .where(eq(connections.companyId, company.id))
        .limit(1);

      if (companyConnections.length === 0) {
        console.warn(`  ⚠️  No connections found for company ${company.name}. Skipping...`);
        continue;
      }

      const connection = companyConnections[0];
      if (!connection) {
        console.warn(`  ⚠️  Connection is undefined for company ${company.name}. Skipping...`);
        continue;
      }
      
      const wabaId = connection.wabaId || 'default';

      console.log(`  🔗 Using connection: ${connection.config_name} (WABA: ${wabaId})`);

      for (const template of PREDEFINED_TEMPLATES) {
        const existingTemplate = await db
          .select()
          .from(messageTemplates)
          .where(eq(messageTemplates.name, template.name))
          .limit(1);

        if (existingTemplate.length > 0 && existingTemplate[0]?.companyId === company.id) {
          console.log(`  ⏭️  Template "${template.displayName}" already exists. Skipping...`);
          totalSkipped++;
          continue;
        }

        const components = [
          {
            type: 'BODY',
            text: template.bodyText,
          },
        ];

        await db.insert(messageTemplates).values({
          name: template.name,
          wabaId: wabaId,
          category: template.category,
          language: 'pt_BR',
          parameterFormat: 'POSITIONAL',
          status: 'APPROVED',
          components: components as any,
          companyId: company.id,
          connectionId: connection.id,
        });

        console.log(`  ✅ Created template: ${template.displayName}`);
        totalCreated++;
      }
    }

    console.log('\n🎉 [Seed] Predefined templates seeding completed!');
    console.log(`   📦 Templates created: ${totalCreated}`);
    console.log(`   ⏭️  Templates skipped: ${totalSkipped}`);
    console.log(`   🏢 Companies processed: ${allCompanies.length}`);
  } catch (error) {
    console.error('❌ [Seed] Error seeding predefined templates:', error);
    throw error;
  }
}

seedPredefinedTemplates()
  .then(() => {
    console.log('\n✨ Seeding script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Seeding script failed:', error);
    process.exit(1);
  });
