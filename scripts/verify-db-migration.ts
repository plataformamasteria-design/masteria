
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function verifyMigration() {
    console.log('🔍 Listando colunas da tabela "ai_personas"...');

    try {
        const result: any = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ai_personas'
    `);

        console.log('DEBUG: Result type:', typeof result);
        console.log('DEBUG: Result keys:', Object.keys(result));

        // Supondo que o driver seja postgres-js ou similar, o resultado pode ser um array direto
        const rows = Array.isArray(result) ? result : (result.rows || []);

        if (rows.length === 0) {
            console.warn('⚠️ Nenhuma coluna encontrada. Tabela existe?');
        }

        const columns = rows.map((r: any) => r.column_name);
        console.log('📋 Colunas encontradas:', columns.join(', '));

        if (columns.includes('resources')) {
            console.log('✅ SUCESSO! A coluna "resources" existe.');
        } else {
            console.error('❌ ERRO: A coluna "resources" NÃO foi encontrada na lista.');
        }
        process.exit(0);
    } catch (error: any) {
        console.error('❌ ERRO: Falha ao listar colunas:', error.message);
        process.exit(1);
    }
}

verifyMigration();
