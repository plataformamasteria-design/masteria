import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function addSettingsCol() {
  console.log('Adicionando coluna settings...');
  try {
    await db.execute(sql`ALTER TABLE kanban_boards ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;`);
    console.log('Coluna adicionada com sucesso!');
  } catch (error) {
    console.error('Erro ao adicionar coluna:', error);
  }
  process.exit(0);
}

addSettingsCol();
