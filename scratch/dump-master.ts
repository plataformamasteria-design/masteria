import { db } from '../src/lib/db';
import { companies, users, connections, kanbanBoards, campaigns, contacts, conversations } from '../src/lib/db/schema';
import { eq, ilike } from 'drizzle-orm';
import fs from 'fs';

async function main() {
  const orgs = await db.select().from(companies).where(ilike(companies.name, '%Master%'));
  
  if (orgs.length === 0) {
    fs.writeFileSync('scratch/master-data.json', JSON.stringify({ error: 'Not found' }));
    process.exit(0);
  }

  const result = [];

  for (const org of orgs) {
    const orgUsers = await db.select({ name: users.name, email: users.email, role: users.role }).from(users).where(eq(users.companyId, org.id));
    const orgConnections = await db.select({ name: connections.config_name, type: connections.connectionType, status: connections.status, active: connections.isActive }).from(connections).where(eq(connections.companyId, org.id));
    const orgBoards = await db.select({ name: kanbanBoards.name }).from(kanbanBoards).where(eq(kanbanBoards.companyId, org.id));
    const orgCampaigns = await db.select({ name: campaigns.name, status: campaigns.status }).from(campaigns).where(eq(campaigns.companyId, org.id));
    const orgContacts = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.companyId, org.id));
    const orgConvs = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.companyId, org.id));

    result.push({
      company: org,
      users: orgUsers,
      connections: orgConnections,
      boards: orgBoards,
      campaigns: orgCampaigns.length,
      contacts: orgContacts.length,
      conversations: orgConvs.length
    });
  }

  fs.writeFileSync('scratch/master-data.json', JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(console.error);
