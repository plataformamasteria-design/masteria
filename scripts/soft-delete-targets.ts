
import { db } from '../src/lib/db';
import { companies, users, contacts, conversations } from '../src/lib/db/schema';
import { eq, ilike, inArray } from 'drizzle-orm';

const TARGET_COMPANIES = [
  "Gabriel Pantoni Rosa's Company",
  "Jocelma Ferreira de Faria 's Company"
];

const MASTER_COMPANY = "Empresa de Desenvolvimento Master";

async function softDeleteTargets() {
  console.log('🚀 Iniciando limpeza segura (Soft Delete)...');

  try {
    // 1. Processar Empresas para Remoção Total (Gabriel e Jocelma)
    for (const companyName of TARGET_COMPANIES) {
      console.log(`\n🔍 Processando empresa: "${companyName}"`);
      
      const company = await db.query.companies.findFirst({
        where: ilike(companies.name, companyName)
      });

      if (!company) {
        console.log(`   ⚠️ Empresa não encontrada: ${companyName}`);
        continue;
      }

      // Soft Delete na Empresa
      await db.update(companies)
        .set({ deletedAt: new Date() })
        .where(eq(companies.id, company.id));
      console.log(`   ✅ Empresa marcada como deletada (ID: ${company.id})`);

      // Soft Delete nos Usuários da Empresa
      await db.update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.companyId, company.id));
      console.log(`   ✅ Usuários da empresa marcados como deletados.`);
    }

    // 2. Processar Empresa Master (Limpeza de Dados, manter Admin)
    console.log(`\n🔍 Processando empresa principal: "${MASTER_COMPANY}"`);
    const masterCompany = await db.query.companies.findFirst({
      where: ilike(companies.name, MASTER_COMPANY)
    });

    if (masterCompany) {
      // Soft Delete em Contatos
      const contactsResult = await db.update(contacts)
        .set({ deletedAt: new Date() })
        .where(eq(contacts.companyId, masterCompany.id))
        .returning({ id: contacts.id });
      console.log(`   ✅ ${contactsResult.length} contatos movidos para a lixeira.`);

      // Arquivar Conversas (Soft Delete via archivedAt)
      const conversationsResult = await db.update(conversations)
        .set({ archivedAt: new Date(), status: 'CLOSED' })
        .where(eq(conversations.companyId, masterCompany.id))
        .returning({ id: conversations.id });
      console.log(`   ✅ ${conversationsResult.length} conversas arquivadas/fechadas.`);

      console.log(`   ℹ️ Empresa e Usuários Admin (Super Admin) foram PRESERVADOS.`);
    } else {
      console.log(`   ⚠️ Empresa Master não encontrada.`);
    }

    console.log('\n🏁 Limpeza concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
  }
  process.exit(0);
}

softDeleteTargets();
