import 'dotenv/config';
import { db } from './src/lib/db';
import { contacts, contactsToTags, tags, companies } from './src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function checkDeividTags() {
  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Henrique%Felipe%')
  });

  if (!company) {
    console.log("Companhia não encontrada.");
    process.exit(0);
  }

  const deivid = await db.query.contacts.findFirst({
    where: ilike(contacts.name, '%Deivid%Rodrigues%')
  });

  if (!deivid) {
    console.log("Deivid não encontrado.");
    process.exit(0);
  }

  const contactTagsQuery = await db.select({ tagName: tags.name })
    .from(contactsToTags)
    .innerJoin(tags, eq(contactsToTags.tagId, tags.id))
    .where(eq(contactsToTags.contactId, deivid.id));

  console.log(`Deivid tem as seguintes tags associadas:`);
  console.log(contactTagsQuery.map(t => t.tagName));

  process.exit(0);
}

checkDeividTags().catch(console.error);
