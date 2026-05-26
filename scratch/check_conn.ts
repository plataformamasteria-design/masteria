import { db } from '../src/lib/db';
import { companies, connections } from '../src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function main() {
  const comps = await db.select().from(companies).where(ilike(companies.name, '%Empresa de Desenvolvimento Master%'));
  if (comps.length === 0) { console.log('Company not found'); return; }
  const companyId = comps[0].id;
  
  const conns = await db.select().from(connections).where(eq(connections.companyId, companyId));
  console.log('\n--- Connections ---');
  for (const c of conns) {
      console.log(`ID: ${c.id} | ConfigName: ${c.config_name} | SessionName: ${c.sessionName}`);
  }
  process.exit(0);
}

main().catch(console.error);
