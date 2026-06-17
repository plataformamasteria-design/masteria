import { db } from '../src/lib/db';
import { companies, users, connections, kanbanBoards, campaigns, contacts, conversations } from '../src/lib/db/schema';
import { eq, ilike } from 'drizzle-orm';

async function main() {
  console.log('Buscando empresa "Master"...');
  const orgs = await db.select().from(companies).where(ilike(companies.name, '%Master%'));
  
  if (orgs.length === 0) {
    console.log('Nenhuma empresa encontrada com "Master" no nome.');
    process.exit(0);
  }

  for (const org of orgs) {
    console.log('\n=======================================');
    console.log(`Empresa: ${org.name}`);
    console.log(`ID: ${org.id}`);
    console.log(`Criada em: ${org.createdAt}`);
    console.log('=======================================');

    const orgUsers = await db.select().from(users).where(eq(users.companyId, org.id));
    console.log(`\n👥 Usuários (${orgUsers.length}):`);
    orgUsers.forEach(u => console.log(` - ${u.name} (${u.email}) [${u.role}]`));

    const orgConnections = await db.select().from(connections).where(eq(connections.companyId, org.id));
    console.log(`\n🔌 Conexões (${orgConnections.length}):`);
    orgConnections.forEach(c => console.log(` - ${c.config_name} (${c.connectionType}) [Status: ${c.status}, Ativo: ${c.isActive}]`));

    const orgBoards = await db.select().from(kanbanBoards).where(eq(kanbanBoards.companyId, org.id));
    console.log(`\n📋 Kanban Boards (${orgBoards.length}):`);
    orgBoards.forEach(b => console.log(` - ${b.name}`));

    const orgCampaigns = await db.select().from(campaigns).where(eq(campaigns.companyId, org.id));
    console.log(`\n🚀 Campanhas (${orgCampaigns.length}):`);
    orgCampaigns.forEach(c => console.log(` - ${c.name} [Status: ${c.status}]`));

    // Get count of contacts
    const orgContacts = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.companyId, org.id));
    console.log(`\n👤 Contatos: ${orgContacts.length}`);

    // Get count of conversations
    const orgConvs = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.companyId, org.id));
    console.log(`💬 Conversas: ${orgConvs.length}`);
  }

  process.exit(0);
}

main().catch(console.error);
