
import { db } from '@/lib/db';
import { companyQuotas } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function fixCompanyQuotas() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  CORREÇÃO DE QUOTA DE TOKENS (company_quotas)                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    try {
        const result = await db.update(companyQuotas)
            .set({ 
                currentAiTokensMonth: 0,
                maxAiTokens: 10000000, // Aumentar para 10 milhões (segurança)
                updatedAt: new Date()
            })
            .returning();

        console.log(`✅ Sucesso! Quota corrigida para ${result.length} empresas.`);
        result.forEach(c => {
            console.log(`   - Empresa ID: ${c.companyId} | Uso: ${c.currentAiTokensMonth} | Max: ${c.maxAiTokens}`);
        });

    } catch (error) {
        console.error('❌ Erro ao corrigir quota:', error);
    }
    process.exit(0);
}

fixCompanyQuotas();
