import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { companies } from '../src/lib/db/schema';

async function list() {
  const sql = postgres(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const allCompanies = await db.select().from(companies);
  console.log("Empresas disponíveis no DB:");
  allCompanies.forEach(c => console.log(`- ${c.name}: ${c.id}`));
  
  process.exit(0);
}

list().catch(console.error);
