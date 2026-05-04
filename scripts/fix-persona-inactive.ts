/**
 * fix-persona-inactive.ts
 * 
 * Script para ativar a persona ASSESSOR GCR - ALUNOS
 */

import { db } from '../src/lib/db';
import { aiPersonas } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const PERSONA_ID = '4d7850a6-cc29-4255-9b4f-c9282c50b60f';

async function main() {
    console.log('🔧 Ativando persona...');

    // Verificar estado atual
    const [persona] = await db.select()
        .from(aiPersonas)
        .where(eq(aiPersonas.id, PERSONA_ID));

    if (!persona) {
        console.log('❌ Persona não encontrada');
        process.exit(1);
    }

    console.log(`📋 Estado atual:`);
    console.log(`   Nome: ${persona.name}`);
    console.log(`   isActive: ${persona.isActive}`);

    if (persona.isActive) {
        console.log('✅ Persona já está ativa. Nenhuma alteração necessária.');
        process.exit(0);
    }

    // Ativar persona
    await db.update(aiPersonas)
        .set({ isActive: true })
        .where(eq(aiPersonas.id, PERSONA_ID));

    // Verificar atualização
    const [updated] = await db.select()
        .from(aiPersonas)
        .where(eq(aiPersonas.id, PERSONA_ID));

    console.log(`\n✅ Persona atualizada:`);
    console.log(`   Nome: ${updated.name}`);
    console.log(`   isActive: ${updated.isActive}`);

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
