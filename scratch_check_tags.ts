import 'dotenv/config';
import { db } from './src/lib/db';
import { tags, companies } from './src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function check() {
  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Henrique%Felipe%')
  });

  if (!company) {
    console.log("Companhia Henrique Felipe não encontrada.");
    process.exit(0);
  }

  const allTags = await db.query.tags.findMany({
    where: eq(tags.companyId, company.id)
  });

  console.log(`Tags na companhia:`);
  allTags.forEach(t => console.log(`ID: ${t.id} | Nome: "${t.name}"`));
  process.exit(0);
}

check().catch(console.error);
