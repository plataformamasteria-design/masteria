// Script para verificar quotas da empresa
import { db } from '../src/lib/db';
import { companyQuotas, companies } from '../src/lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🔍 Verificando quotas de todas as empresas...\n');

    const rows = await db.execute(sql`
        SELECT 
            c.id as company_id,
            c.name as company_name,
            q.max_ai_tokens,
            q.current_ai_tokens_month,
            ROUND((q.current_ai_tokens_month::numeric / q.max_ai_tokens::numeric) * 100, 2) as usage_percent,
            q.updated_at
        FROM companies c
        LEFT JOIN company_quotas q ON q.company_id = c.id
        ORDER BY q.current_ai_tokens_month DESC NULLS LAST
    `);

    const data = Array.isArray(rows) ? rows : (rows as any)?.rows || [];

    console.log('📊 USO DE TOKENS DE IA:\n');
    console.log('─'.repeat(80));

    for (const row of data) {
        const used = row.current_ai_tokens_month || 0;
        const max = row.max_ai_tokens || 100000;
        const percent = ((used / max) * 100).toFixed(1);
        const status = used >= max ? '❌ ESGOTADO' : used > max * 0.8 ? '⚠️ ALTO' : '✅ OK';

        console.log(`\n🏢 ${row.company_name || 'Empresa sem nome'}`);
        console.log(`   ID: ${row.company_id}`);
        console.log(`   Tokens usados: ${used.toLocaleString()} / ${max.toLocaleString()} (${percent}%)`);
        console.log(`   Status: ${status}`);
    }

    console.log('\n' + '═'.repeat(80));

    process.exit(0);
}

main().catch(err => {
    console.error('Erro:', err);
    process.exit(1);
});
