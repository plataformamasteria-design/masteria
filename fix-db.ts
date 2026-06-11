import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Adicionando coluna custom_fields na tabela kanban_leads...');
  try {
    await db.execute(sql`ALTER TABLE kanban_leads ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;`);
    console.log('Coluna adicionada com sucesso!');
  } catch (error) {
    console.error('Erro:', error);
  }
  process.exit(0);
}

main();
