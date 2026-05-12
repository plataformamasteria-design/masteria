import 'dotenv/config';
import { db } from './src/lib/db';
import { contacts, companies } from './src/lib/db/schema';
import { ilike } from 'drizzle-orm';

async function checkDeivid() {
  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Henrique%Felipe%')
  });

  if (!company) process.exit(0);

  const deivid = await db.query.contacts.findFirst({
    where: ilike(contacts.name, '%Deivid%Rodrigues%')
  });

  console.log(deivid);
  process.exit(0);
}

checkDeivid().catch(console.error);
