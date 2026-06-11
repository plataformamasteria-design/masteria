import { db } from '../src/lib/db';
import { contacts, kanbanLeads } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { normalizeBrazilianSMS } from '../src/lib/utils/phone';

async function main() {
  console.log('Buscando todos os contatos...');
  const allContacts = await db.select({
    id: contacts.id,
    name: contacts.name,
    phone: contacts.phone,
    companyId: contacts.companyId
  }).from(contacts);

  console.log(`Total de contatos: ${allContacts.length}`);

  // Agrupar por empresa e telefone normalizado
  const normalizedMap: Record<string, typeof allContacts> = {};

  for (const c of allContacts) {
    if (!c.phone) continue;
    // Tenta normalizar o número (remover 55, formatar DDD+9)
    const norm = normalizeBrazilianSMS(c.phone);
    const keyPhone = norm.valid ? norm.number : c.phone.replace(/\D/g, '');
    const key = `${c.companyId}_${keyPhone}`;

    if (!normalizedMap[key]) {
      normalizedMap[key] = [];
    }
    normalizedMap[key].push(c);
  }

  let duplicatesFound = 0;

  for (const [key, group] of Object.entries(normalizedMap)) {
    if (group.length > 1) {
      duplicatesFound++;
      console.log(`\n--- DUPLICATA ENCONTRADA ---`);
      console.log(`Chave normalizada: ${key.split('_')[1]} (Empresa: ${group[0].companyId})`);
      for (const c of group) {
        // Buscar quantos leads esse contato tem
        const leads = await db.select({ id: kanbanLeads.id }).from(kanbanLeads).where(
            eq(kanbanLeads.contactId, c.id)
        );
        console.log(`  - Contato ID: ${c.id} | Nome: ${c.name} | Telefone: ${c.phone} | Leads: ${leads.length}`);
      }
    }
  }

  console.log(`\nTotal de grupos duplicados encontrados: ${duplicatesFound}`);
  process.exit(0);
}

main().catch(console.error);
