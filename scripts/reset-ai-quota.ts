
import { db } from '@/lib/db';
import { companies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function resetCompanyQuota() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  RESET DE QUOTA DE TOKENS (EMERGÊNCIA)                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    try {
        // Resetar para todas as empresas (ambiente de dev/teste) ou filtrar por ID específico se soubesse
        // Como é um ambiente controlado, vou resetar de todas para garantir
        const result = await db.update(companies)
            .set({ 
                aiUsage: 0,
                updatedAt: new Date() // Forçar update para garantir que o SQL seja gerado
            })
            .returning();

        console.log(`✅ Sucesso! Quota resetada para ${result.length} empresas.`);
        result.forEach(c => {
            console.log(`   - Empresa: ${c.name} (ID: ${c.id}) -> Uso: ${c.aiUsage}`);
        });

    } catch (error) {
        console.error('❌ Erro ao resetar quota:', error);
    }
    process.exit(0);
}

resetCompanyQuota();
