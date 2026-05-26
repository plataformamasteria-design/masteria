require('dotenv').config({ path: '.env.local' });
async function main() {
  const { db } = await import('../src/lib/db');
  const { kanbanLeads, contacts } = await import('../src/lib/db/schema');
  const { eq, ilike, or } = await import('drizzle-orm');

  const c = await db.select({ id: contacts.id, name: contacts.name }).from(contacts).where(
    or(ilike(contacts.name, '%Priscilla%'), ilike(contacts.name, '%Kayra Cipriano%'))
  );

  for (const contact of c) {
    const leads = await db.select({ id: kanbanLeads.id, createdAt: kanbanLeads.createdAt }).from(kanbanLeads).where(eq(kanbanLeads.contactId, contact.id));
    for (const l of leads) {
      console.log(`Contact: ${contact.name} | Lead createdAt: ${l.createdAt.getTime()} (${l.createdAt.toISOString()})`);
    }
  }

  process.exit(0);
}
main().catch(console.error);
