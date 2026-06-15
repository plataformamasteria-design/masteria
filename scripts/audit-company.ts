import 'dotenv/config';
import { db } from '../src/lib/db';
import { contacts, conversations, connections } from '../src/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';

async function audit() {
  const companyId = 'a3591171-a146-4ed1-b49f-d0708cb7cdbd';
  console.log(`Iniciando auditoria para a empresa: ${companyId}\n`);

  try {
    // 1. Audit Contacts (Duplicate phones)
    const allContacts = await db.select().from(contacts).where(eq(contacts.companyId, companyId));
    const phoneMap = new Map();
    let duplicatePhones = 0;
    
    for (const c of allContacts) {
      if (!phoneMap.has(c.phone)) phoneMap.set(c.phone, []);
      phoneMap.get(c.phone).push(c);
    }
    
    console.log(`--- Auditoria de Contatos ---`);
    console.log(`Total de Contatos: ${allContacts.length}`);
    for (const [phone, list] of phoneMap.entries()) {
      if (list.length > 1) {
        duplicatePhones++;
        console.log(`- Telefone duplicado: ${phone} (${list.length} cadastros distintos)`);
        for (const dup of list) {
             console.log(`  -> ID: ${dup.id} | Nome: ${dup.name}`);
        }
      }
    }
    if (duplicatePhones === 0) console.log(`Nenhum contato com telefone duplicado encontrado. Status: OK`);
    console.log('');

    // 2. Audit Conversations (Orphans and Duplicates)
    const allConvs = await db.select().from(conversations).where(eq(conversations.companyId, companyId));
    const convMap = new Map();
    let orphanConvs = 0;

    for (const c of allConvs) {
      if (!convMap.has(c.contactId)) convMap.set(c.contactId, []);
      convMap.get(c.contactId).push(c);
      if (c.connectionId === null) orphanConvs++;
    }

    console.log(`--- Auditoria de Conversas ---`);
    console.log(`Total de Conversas: ${allConvs.length}`);
    console.log(`Conversas Órfãs (sem conexão / conexão excluída): ${orphanConvs}`);
    
    let duplicateConvs = 0;
    for (const [contactId, list] of convMap.entries()) {
      if (list.length > 1) {
        duplicateConvs++;
        console.log(`- Contato ID ${contactId} tem ${list.length} conversas:`);
        for (const conv of list) {
          console.log(`  -> Conv ID: ${conv.id} | Status: ${conv.status} | Conn ID: ${conv.connectionId || 'ORPHAN'}`);
        }
      }
    }
    if (duplicateConvs === 0) console.log(`Nenhum contato possui múltiplas conversas. Status: OK`);
    console.log('');

    // 3. Audit Connections
    const allConns = await db.select().from(connections).where(eq(connections.companyId, companyId));
    console.log(`--- Auditoria de Conexões ---`);
    console.log(`Total de Conexões Ativas no Banco: ${allConns.length}`);
    for (const c of allConns) {
      console.log(`- Nome: ${c.config_name} | ID: ${c.id} | Status: ${c.status || c.connectionStatus}`);
    }

  } catch (error) {
    console.error('Erro na auditoria:', error);
  } finally {
    process.exit(0);
  }
}

audit();
