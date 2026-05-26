import { db } from '../src/lib/db';
import { companies } from '../src/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  const comps = await db.select().from(companies).where(inArray(companies.id, ['7cb4773e-1fab-4699-b35d-c70d9f8d9149', '763a89b7-164f-48c5-8765-98d0a147bc1d']));
  
  for (const c of comps) {
      console.log(`Company ID: ${c.id} | Name: ${c.name}`);
  }

  process.exit(0);
}

main().catch(console.error);
