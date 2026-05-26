require('dotenv').config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/lib/db');
  const { kanbanBoards, kanbanLeads, contacts, users, companies } = await import('../src/lib/db/schema');
  const { eq, ilike, and, inArray } = await import('drizzle-orm');

  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

  // Get all boards
  const boards = await db.query.kanbanBoards.findMany({
    where: eq(kanbanBoards.companyId, companyId)
  });

  console.log('\n=== BOARDS ===');
  for (const b of boards) {
    const stages = b.stages as any[];
    const leadCount = await db.select({ count: kanbanLeads.id }).from(kanbanLeads)
      .where(and(eq(kanbanLeads.boardId, b.id)));
    console.log(`Board: ${b.name}`);
    console.log(`  ID: ${b.id}`);
    console.log(`  Leads total: ${leadCount.length}`);
    stages.forEach((s, i) => console.log(`  Stage[${i}]: "${s.title}" (id: ${s.id})`));
    console.log('');
  }

  // Get all company users
  console.log('\n=== COMPANY USERS ===');
  const allUsers = await db.query.users.findMany({
    where: eq(users.companyId, companyId)
  });
  for (const u of allUsers) {
    console.log(`  User: ${u.name || u.email} | ID: ${u.id}`);
  }

  // Get all conversations with connections to understand the connection mapping
  const { whatsappConnections, conversations } = await import('../src/lib/db/schema');
  console.log('\n=== CONNECTIONS ===');
  const conns = await db.select().from(whatsappConnections).where(eq(whatsappConnections.companyId, companyId));
  for (const c of conns) {
    console.log(`  Connection: ${c.configName || c.name} | ID: ${c.id} | Status: ${c.status}`);
  }

  process.exit(0);
}
main().catch(console.error);
