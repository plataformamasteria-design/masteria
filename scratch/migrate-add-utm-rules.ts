import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  await db.execute(sql`
    ALTER TABLE companies 
    ADD COLUMN IF NOT EXISTS utm_routing_rules jsonb DEFAULT '[]'::jsonb
  `);
  console.log('✅ Coluna utm_routing_rules adicionada à tabela companies');
  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
