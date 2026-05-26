require('dotenv').config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/lib/db');
  const { kanbanLeads } = await import('../src/lib/db/schema');
  const { eq, inArray } = await import('drizzle-orm');

  const testIds = [
    "14f9343a-261b-4773-9c60-462b17f200ef", // first lead ID from excel
    "e75e21ed-1767-4a8c-aaec-76483a623582", // second
    "e20f9ccd-8cef-465b-be50-ebd064e1a966"  // third
  ];

  const leads = await db.query.kanbanLeads.findMany({
    where: inArray(kanbanLeads.externalId, testIds),
    with: { contact: true }
  });

  console.log('Found by externalId:', leads.length);
  for (const l of leads) {
    console.log(`Lead: ${l.id} | External: ${l.externalId} | Phone: ${l.contact.phone} | Created: ${l.createdAt}`);
  }

  // What if they are found by phone?
  const testPhones = [
    "55 19354237888",
    "55 31999990747",
    "55 67981016001"
  ].map(p => p.replace(/\D/g, ''));

  const contacts = await db.query.contacts.findMany({
    where: inArray(db._.schema.contacts.phone, testPhones)
  });
  
  console.log('Found contacts by raw phone:', contacts.length);
  process.exit(0);
}
main().catch(console.error);
