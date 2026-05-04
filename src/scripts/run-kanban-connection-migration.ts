// src/scripts/run-kanban-connection-migration.ts
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🚀 Iniciando migração: Adicionar connection_ids na tabela kanban_boards...');

    try {
        const migrationSql = `
          ALTER TABLE "kanban_boards" 
          ADD COLUMN IF NOT EXISTS "connection_ids" TEXT[];

          COMMENT ON COLUMN "kanban_boards"."connection_ids" IS 'IDs de conexões vinculadas para roteamento automático de leads';
        `;

        console.log('📝 Executando SQL...');
        await db.execute(sql.raw(migrationSql));
        console.log('✅ Migração concluída com sucesso!');

        // Verificar se o campo foi criado
        const checkTable = await db.execute(sql`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'kanban_boards' 
          AND column_name = 'connection_ids';
        `);

        console.log('🔍 Verificação de coluna:', checkTable.rows);

    } catch (error) {
        console.error('❌ Erro na migração:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

main();
