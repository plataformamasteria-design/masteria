import 'dotenv/config';
import { db } from '../src/lib/db';
import { contacts, conversations } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function mergeDeivid() {
  const masterId = 'fff2ff46-11dd-420b-8261-e61031bdf96b'; // WhatsApp (Deivid Rodrigues)
  const duplicateId = 'c58435d4-f436-431f-8e4c-19250be20adc'; // Instagram (65816213111020)

  console.log('Iniciando fusão manual do lead Deivid Rodrigues (IG + WA)...');

  try {
    const masterContact = await db.select().from(contacts).where(eq(contacts.id, masterId)).then(r => r[0]);
    const duplicateContact = await db.select().from(contacts).where(eq(contacts.id, duplicateId)).then(r => r[0]);

    if (!masterContact || !duplicateContact) {
      console.log('Contatos não encontrados. Verifique os IDs.');
      process.exit(1);
    }

    console.log(`- Master: ${masterContact.name} (${masterContact.phone})`);
    console.log(`- Duplicata: ${duplicateContact.name} (${duplicateContact.phone})`);

    // 1. Reatribuir as conversas da duplicata para o Master
    const movedConvs = await db.update(conversations)
      .set({ contactId: masterContact.id })
      .where(eq(conversations.contactId, duplicateContact.id))
      .returning({ id: conversations.id, connectionId: conversations.connectionId });

    console.log(`  - Reatribuídas ${movedConvs.length} conversas (Instagram) para o Master Contact.`);

    // 2. Deletar o contato duplicado (Instagram)
    await db.delete(contacts).where(eq(contacts.id, duplicateContact.id));
    console.log(`  - Contato duplicado (IG) deletado.`);

    console.log('Fusão concluída com sucesso!');
  } catch (error) {
    console.error('Erro na fusão:', error);
  } finally {
    process.exit(0);
  }
}

mergeDeivid();
