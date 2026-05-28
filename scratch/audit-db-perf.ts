import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function auditDB() {
  try {
    console.log('--- TAMANHO DAS TABELAS ---');
    const sizes = await db.execute(sql`
      SELECT relname as "Table",
             n_live_tup as "Rows"
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC;
    `);
    console.table(sizes);

    console.log('\n--- ÍNDICES AUSENTES (Missing Indexes) ---');
    const missingIndexes = await db.execute(sql`
      SELECT
        relname AS table_name,
        seq_scan,
        seq_tup_read,
        idx_scan,
        seq_tup_read / seq_scan AS avg_rows_scanned
      FROM pg_stat_user_tables
      WHERE seq_scan > 0
      ORDER BY seq_tup_read DESC
      LIMIT 10;
    `);
    console.table(missingIndexes);
    
  } catch (error: any) {
    console.error('Erro:', error.message);
  }
  process.exit(0);
}

auditDB();
