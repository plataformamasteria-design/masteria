
import { db } from '@/lib/db';
import { contacts, companies } from '@/lib/db/schema';
import { eq, desc, and, isNotNull, not } from 'drizzle-orm';

async function main() {
  try {
    const allCompanies = await db.select().from(companies);
    
    console.log('='.repeat(80));
    console.log(`LEVANTAMENTO DA BASE DE CONTATOS`);
    console.log(`Data: ${new Date().toLocaleString()}`);
    console.log('='.repeat(80));
    
    let globalTotal = 0;

    for (const company of allCompanies) {
      // Coletar todos os contatos da empresa para processamento em memória
      // (Para bases gigantescas, seria melhor usar count() no SQL, mas aqui permite flexibilidade)
      const allContacts = await db.select().from(contacts).where(eq(contacts.companyId, company.id));
      
      const total = allContacts.length;
      globalTotal += total;

      // Métricas
      const groups = allContacts.filter(c => c.isGroup).length;
      const individuals = total - groups;
      const active = allContacts.filter(c => c.status === 'ACTIVE').length;
      const withEmail = allContacts.filter(c => c.email && c.email.trim() !== '').length;
      
      // Amostra recente (últimos 5)
      const recent = await db.select({
        name: contacts.name,
        phone: contacts.phone,
        isGroup: contacts.isGroup,
        createdAt: contacts.createdAt
      })
      .from(contacts)
      .where(eq(contacts.companyId, company.id))
      .orderBy(desc(contacts.createdAt))
      .limit(5);

      console.log(`\nEMPRESA: ${company.name}`);
      console.log(`ID: ${company.id}`);
      console.log('-'.repeat(40));
      console.log(`TOTAL DE CONTATOS: ${total}`);
      console.log(`  ├── Individuais: ${individuals}`);
      console.log(`  ├── Grupos: ${groups}`);
      console.log(`  ├── Ativos: ${active}`);
      console.log(`  └── Com Email: ${withEmail}`);
      
      if (recent.length > 0) {
        console.log(`\n  Últimos 5 adicionados:`);
        recent.forEach(c => {
            const type = c.isGroup ? '[GRUPO]' : '[PESSOA]';
            const date = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A';
            console.log(`    - ${type} ${c.name} (${c.phone}) em ${date}`);
        });
      } else {
        console.log(`\n  (Sem contatos registrados)`);
      }
      console.log('_'.repeat(80));
    }
    
    console.log(`\nTOTAL GERAL NO SISTEMA: ${globalTotal} contatos.`);

  } catch (error) {
    console.error('Erro ao gerar levantamento:', error);
  } finally {
    process.exit(0);
  }
}

main();
