
import { db } from '@/lib/db';
import { companies, contacts, contactLists } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
  console.log('🔍 Iniciando Verificação de Integridade de Dados Multi-Tenant...\n');

  // 1. Buscar todas as empresas
  const allCompanies = await db.select().from(companies);
  console.log(`🏢 Total de empresas encontradas: ${allCompanies.length}\n`);

  console.log('📊 Relatório por Empresa:');
  console.log('---------------------------------------------------------------------------------');
  console.log('| ID (Short) | Nome                                       | Listas | Contatos |');
  console.log('---------------------------------------------------------------------------------');

  for (const company of allCompanies) {
    // Contar listas
    const [listsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contactLists)
      .where(eq(contactLists.companyId, company.id));

    // Contar contatos
    const [contactsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(eq(contacts.companyId, company.id));

    const shortId = company.id.slice(0, 8);
    const name = company.name.padEnd(42).slice(0, 42);
    // Drizzle with COUNT returns an array like [{ count: number }] or just { count: number } depending on driver
    const listsVal = Array.isArray(listsCount) ? listsCount[0]?.count : (listsCount as any).count;
    const contsVal = Array.isArray(contactsCount) ? contactsCount[0]?.count : (contactsCount as any).count;

    const lists = String(listsVal || 0).padStart(6);
    const conts = String(contsVal || 0).padStart(8);

    console.log(`| ${shortId} | ${name} | ${lists} | ${conts} |`);
  }
  console.log('---------------------------------------------------------------------------------\n');

  // Validação específica
  const sourceCompanyId = '682b91ea-15ee-42da-8855-70309b237008'; // Diego's Company
  const targetCompanies = allCompanies.filter(c => c.id !== sourceCompanyId);
  
  let success = true;
  for (const company of targetCompanies) {
    const [contactsCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(eq(contacts.companyId, company.id));

    const finalContsVal = Array.isArray(contactsCount) ? contactsCount[0]?.count : (contactsCount as any).count;
    if (Number(finalContsVal || 0) === 0) {
        console.warn(`⚠️ ALERTA: Empresa ${company.name} ainda tem 0 contatos!`);
        success = false;
    }
  }

  if (success) {
      console.log('✅ SUCESSO: Todas as empresas possuem dados populados.');
  } else {
      console.log('⚠️ ATENÇÃO: Algumas empresas ainda estão vazias ou em processo de replicação.');
  }
}

main().catch(console.error);
