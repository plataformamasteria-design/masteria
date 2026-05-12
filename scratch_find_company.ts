import { db } from './src/lib/db';
import { companies } from './src/lib/db/schema';
import { ilike } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const query = '%Douglas Resende%';
  console.log(`Buscando empresa com nome similar a: ${query}`);
  
  const results = await db.select().from(companies).where(ilike(companies.name, query));
  
  if (results.length === 0) {
    console.log('Nenhuma empresa encontrada.');
  } else {
    for (const company of results) {
      console.log(`Encontrado: ${company.name} - ID: ${company.id}`);
    }
  }
  process.exit(0);
}

run().catch(console.error);
