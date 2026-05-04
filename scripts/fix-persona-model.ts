/**
 * fix-persona-model.ts
 * 
 * Script para atualizar o modelo da persona para gemini-2.0-flash
 */

import { db } from '../src/lib/db';
import { aiPersonas } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const PERSONA_ID = '4d7850a6-cc29-4255-9b4f-c9282c50b60f';
const NEW_MODEL = 'gemini-2.0-flash';

async function main() {
    console.log('🔧 Atualizando modelo da persona...\n');

    // 1. Verificar estado atual
    const [persona] = await db.select()
        .from(aiPersonas)
        .where(eq(aiPersonas.id, PERSONA_ID));

    if (!persona) {
        console.log('❌ Persona não encontrada');
        process.exit(1);
    }

    console.log(`📋 Estado atual:`);
    console.log(`   Nome: ${persona.name}`);
    console.log(`   Modelo: ${persona.model}`);
    console.log(`   credentialId: ${persona.credentialId || 'null'}`);

    // 2. Atualizar modelo
    console.log(`\n🔄 Atualizando modelo para: ${NEW_MODEL}`);

    await db.update(aiPersonas)
        .set({ model: NEW_MODEL })
        .where(eq(aiPersonas.id, PERSONA_ID));

    // 3. Verificar atualização
    const [updated] = await db.select()
        .from(aiPersonas)
        .where(eq(aiPersonas.id, PERSONA_ID));

    console.log(`\n✅ Persona atualizada:`);
    console.log(`   Nome: ${updated.name}`);
    console.log(`   Modelo: ${updated.model}`);
    console.log(`   credentialId: ${updated.credentialId || 'null'}`);

    console.log('\n🎉 Modelo atualizado com sucesso!');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
