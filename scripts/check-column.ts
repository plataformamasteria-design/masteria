
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function checkColumn() {
  try {
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'deleted_at';
    `);
    
    if (result.length > 0) {
      console.log('✅ Coluna deleted_at existe na tabela users.');
    } else {
      console.log('❌ Coluna deleted_at NÃO existe na tabela users.');
    }
  } catch (error) {
    console.error('Erro ao verificar coluna:', error);
  }
  process.exit(0);
}

checkColumn();
