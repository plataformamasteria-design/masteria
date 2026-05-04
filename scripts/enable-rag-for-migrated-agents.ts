// scripts/enable-rag-for-migrated-agents.ts
import { db } from '../src/lib/db';
import { aiPersonas, personaPromptSections } from '../src/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function enableRagForMigratedAgents() {
    console.log('🔄 Ativando RAG para agentes com seções migradas...\n');

    try {
        // 1. Buscar todos os agentes que têm seções mas RAG desativado
        const agentsWithSections = await db
            .select({
                personaId: personaPromptSections.personaId,
                personaName: aiPersonas.name,
                useRag: aiPersonas.useRag,
                sectionsCount: sql<number>`count(*)::int`,
            })
            .from(personaPromptSections)
            .innerJoin(aiPersonas, eq(aiPersonas.id, personaPromptSections.personaId))
            .where(eq(aiPersonas.useRag, false))
            .groupBy(personaPromptSections.personaId, aiPersonas.name, aiPersonas.useRag);

        if (agentsWithSections.length === 0) {
            console.log('✅ Todos os agentes com seções já têm RAG ativo!');
            return;
        }

        console.log(`📊 Encontrados ${agentsWithSections.length} agentes para ativar:\n`);
        
        for (const agent of agentsWithSections) {
            console.log(`  • ${agent.personaName} (${agent.sectionsCount} seções)`);
        }
        
        console.log('\n🔧 Ativando RAG...\n');

        // 2. Ativar RAG para todos esses agentes
        let successCount = 0;
        for (const agent of agentsWithSections) {
            try {
                await db
                    .update(aiPersonas)
                    .set({ useRag: true })
                    .where(eq(aiPersonas.id, agent.personaId));
                
                console.log(`  ✅ ${agent.personaName} → RAG ativado`);
                successCount++;
            } catch (error) {
                console.error(`  ❌ ${agent.personaName} → Erro:`, error);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`✨ CONCLUÍDO!`);
        console.log(`=`.repeat(60));
        console.log(`✅ ${successCount}/${agentsWithSections.length} agentes com RAG ativado`);
        console.log('\n💡 Agora todos os agentes migrados usarão seções modulares!');

    } catch (error) {
        console.error('❌ Erro ao ativar RAG:', error);
        throw error;
    } finally {
        process.exit(0);
    }
}

enableRagForMigratedAgents();
