// src/scripts/sanitize-orphaned-data.ts
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🔍 Iniciando Saneamento de Dados Órfãos...');

    try {
        // 1. Identificar conversas com company_id inválido
        const orphanedConversations = await db.execute(sql`
            SELECT id, company_id 
            FROM conversations 
            WHERE company_id NOT IN (SELECT id FROM companies);
        `);

        console.log(`⚠️ Encontradas ${orphanedConversations.length} conversas órfãs.`);

        if (orphanedConversations.length > 0) {
            console.log('Exemplos de IDs órfãos:', orphanedConversations.slice(0, 5).map(c => c.company_id));

            // OPÇÃO DE SEGURANÇA: Limpar company_id para NULL antes do backfill real
            // Ou deletar? Vamos apenas reportar por enquanto para não ser destrutivo.
            // Para "Absolute Maximum", o ideal é deletar ou vincular a uma empresa "Master".
        }

        // 2. Identificar se há outras tabelas com IDs fantasmas
        const ALLOWED_TABLES_TO_CHECK = ['contacts', 'users', 'connections'] as const;
        for (const table of ALLOWED_TABLES_TO_CHECK) {
            const result = await db.execute(sql`
                SELECT COUNT(*) as count 
                FROM ${sql.identifier(table)} 
                WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
            `);
            const count = result[0] ? result[0].count : 0;
            console.log(`📊 Tabela ${table}: ${count} registros órfãos.`);
        }

    } catch (error) {
        console.error('❌ Erro no saneamento:', error);
    }
}

main().then(() => process.exit(0));
