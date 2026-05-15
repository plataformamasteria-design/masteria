import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Adicionando trial_ends_at...');
    await db.execute(sql`ALTER TABLE companies ADD COLUMN trial_ends_at timestamp;`);
    console.log('Coluna trial_ends_at adicionada com sucesso.');
  } catch (e: any) {
    console.log('Erro ou coluna já existe (trial_ends_at):', e.message);
  }

  try {
    console.log('Adicionando lifetime...');
    await db.execute(sql`ALTER TABLE companies ADD COLUMN lifetime boolean DEFAULT false NOT NULL;`);
    console.log('Coluna lifetime adicionada com sucesso.');
  } catch (e: any) {
    console.log('Erro ou coluna já existe (lifetime):', e.message);
  }

  process.exit(0);
}

main();
