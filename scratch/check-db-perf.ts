import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function checkDb() {
  try {
    console.log('Verificando conexões e queries ativas no banco...');
    const res = await db.execute(sql`
      SELECT pid, state, query_start, now() - query_start AS duration, query
      FROM pg_stat_activity
      WHERE state != 'idle' AND query NOT ILIKE '%pg_stat_activity%'
      ORDER BY duration DESC
      LIMIT 10;
    `);
    
    if (res.length === 0) {
      console.log('Nenhuma query pesada rodando no momento.');
    } else {
      console.table(res);
    }
  } catch (error: any) {
    console.error('Erro ao conectar no banco:', error.message);
  }
  process.exit(0);
}

checkDb();
