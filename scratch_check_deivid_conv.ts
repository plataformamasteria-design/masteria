import 'dotenv/config';
import { db } from './src/lib/db';
import { conversations, companies, contacts } from './src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function checkDeividConv() {
  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Henrique%Felipe%')
  });

  if (!company) process.exit(0);

  const deivid = await db.query.contacts.findFirst({
    where: ilike(contacts.name, '%Deivid%Rodrigues%')
  });

  if (!deivid) process.exit(0);

  const convs = await db.query.conversations.findMany({
    where: eq(conversations.contactId, deivid.id)
  });

  console.log(convs);
  process.exit(0);
}

checkDeividConv().catch(console.error);
