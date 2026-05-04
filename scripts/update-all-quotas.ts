// Script para aumentar quotas de todas as empresas para 2M
import { db } from '../src/lib/db';
import { companyQuotas } from '../src/lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
    const NEW_LIMIT = 2000000;

    console.log(`🔧 Atualizando max_ai_tokens para ${NEW_LIMIT.toLocaleString()} em todas as empresas...\n`);

    // Atualizar todas as quotas existentes
    const updateResult = await db.execute(sql`
        UPDATE company_quotas 
        SET max_ai_tokens = ${NEW_LIMIT}
        RETURNING company_id
    `);

    const updated = Array.isArray(updateResult) ? updateResult.length : (updateResult as any)?.rowCount || 0;

    console.log(`✅ ${updated} empresas atualizadas!\n`);

    // Verificar resultado
    const verifyResult = await db.execute(sql`
        SELECT 
            c.name as company_name,
            q.max_ai_tokens,
            q.current_ai_tokens_month,
            ROUND((q.current_ai_tokens_month::numeric / q.max_ai_tokens::numeric) * 100, 1) as usage_percent
        FROM companies c
        JOIN company_quotas q ON q.company_id = c.id
        ORDER BY q.current_ai_tokens_month DESC
    `);

    const data = Array.isArray(verifyResult) ? verifyResult : (verifyResult as any)?.rows || [];

    console.log('📋 QUOTAS ATUALIZADAS:\n');
    console.log('─'.repeat(70));

    for (const row of data) {
        const status = row.usage_percent > 100 ? '❌' : row.usage_percent > 80 ? '⚠️' : '✅';
        console.log(`${status} ${row.company_name}`);
        console.log(`   Tokens: ${Number(row.current_ai_tokens_month || 0).toLocaleString()} / ${Number(row.max_ai_tokens).toLocaleString()} (${row.usage_percent || 0}%)`);
    }

    console.log('\n' + '═'.repeat(70));
    console.log('✅ Todas as quotas foram atualizadas para 2.000.000 tokens!');

    process.exit(0);
}

main().catch(err => {
    console.error('Erro:', err);
    process.exit(1);
});
