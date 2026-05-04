
import { db } from '@/lib/db';
import { smsGateways, companies } from '@/lib/db/schema';
import { encrypt } from '@/lib/crypto';
import { eq, and } from 'drizzle-orm';
import 'dotenv/config';

// SMS Gateway tokens from environment
// Support both SMSMKOM_API_TOKEN (new) and MKOM_SMS_TOKEN (existing)
const SMSMKOM_API_TOKEN = process.env.SMSMKOM_API_TOKEN || process.env.MKOM_SMS_TOKEN;
if (!SMSMKOM_API_TOKEN) {
  console.error('❌ SMSMKOM_API_TOKEN or MKOM_SMS_TOKEN not set in environment');
  process.exit(1);
}

const TARGET_PROVIDERS = [
  {
    provider: 'witi',
    name: 'SMS Flash Advanced (Auto)',
    credentials: {
      token: SMSMKOM_API_TOKEN
    }
  },
  {
    provider: 'mkom',
    name: 'MKOM (Auto)',
    credentials: {
      token: SMSMKOM_API_TOKEN,
      cost_centre_id: ''
    }
  }
];

async function main() {
  console.log('Iniciando sincronização de gateways SMS...');

  try {
    const allCompanies = await db.select().from(companies);
    console.log(`Encontradas ${allCompanies.length} empresas.`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const company of allCompanies) {
      console.log(`\nProcessando empresa: ${company.name} (${company.id})`);

      for (const gw of TARGET_PROVIDERS) {
        const existing = await db.select()
          .from(smsGateways)
          .where(and(
            eq(smsGateways.companyId, company.id),
            eq(smsGateways.provider, gw.provider)
          ));

        if (existing.length === 0) {
          // Encrypt credentials
          const encryptedCreds = Object.fromEntries(
            Object.entries(gw.credentials).map(([k, v]) => [k, encrypt(v)])
          );

          await db.insert(smsGateways).values({
            companyId: company.id,
            provider: gw.provider,
            name: gw.name,
            credentials: encryptedCreds,
            isActive: true
          });
          console.log(`  [OK] Criado gateway ${gw.provider}`);
          createdCount++;
        } else {
          console.log(`  [SKIP] Gateway ${gw.provider} já existe.`);
          skippedCount++;
        }
      }
    }

    console.log('\n--- Resumo ---');
    console.log(`Gateways criados: ${createdCount}`);
    console.log(`Gateways pulados (já existentes): ${skippedCount}`);
    console.log('Sincronização concluída com sucesso.');

  } catch (error) {
    console.error('Erro durante a execução:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
