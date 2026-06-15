import 'dotenv/config';
import { db } from '../src/lib/db';
import { contacts } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function fixNames() {
  console.log('Iniciando correção de nomes corrompidos (Deivid Rodrigues)...');

  try {
    const corruptedContacts = await db.select().from(contacts).where(eq(contacts.name, 'Deivid Rodrigues'));
    console.log(`Encontrados ${corruptedContacts.length} contatos com nome corrompido.`);

    let updated = 0;
    for (const c of corruptedContacts) {
      // Se for o Deivid real (celular dele 5515974035171), nós preservamos!
      if (c.phone === '5515974035171') {
        console.log(`- Ignorando o Deivid real (${c.phone})`);
        continue;
      }

      await db.update(contacts)
        .set({ 
            name: c.phone, // Restaura para o telefone temporariamente
            whatsappName: null 
        })
        .where(eq(contacts.id, c.id));
      
      console.log(`- Contato ${c.phone} corrigido.`);
      updated++;
    }

    console.log(`\nCorreção concluída! ${updated} contatos atualizados.`);
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    process.exit(0);
  }
}

fixNames();
