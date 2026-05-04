
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function forceAddColumn() {
  console.log('🔧 Adicionando colunas deleted_at manualmente...');
  
  try {
    // Adicionar em companies
    await db.execute(sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);
    console.log('✅ Coluna deleted_at adicionada em companies.');

    // Adicionar em users
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);
    console.log('✅ Coluna deleted_at adicionada em users.');

  } catch (error) {
    console.error('❌ Erro ao adicionar colunas:', error);
  }
  process.exit(0);
}

forceAddColumn();
