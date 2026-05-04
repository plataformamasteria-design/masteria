// scripts/update-gemini-model.ts
// Script para atualizar modelo Gemini para gemini-2.5-flash-lite (estável, gratuito e compatível conforme documentação oficial)

import { db } from '../src/lib/db';
import { aiPersonas } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function updateGeminiModel() {
    try {
        console.log('🔄 Atualizando modelo Gemini para gemini-2.5-flash-lite (modelo estável e gratuito)...');
        
        // ID da persona "EDN Atendimento - Antônio/Pablo (Gemini)" dos logs
        const personaId = '71c7a1c6-8903-436a-b0c1-699a746af25c';
        const oldModel = 'gemini-pro'; // Atualizando de gemini-pro para gemini-2.5-flash-lite
        const newModel = 'gemini-2.5-flash-lite'; // Modelo estável, gratuito e compatível (conforme documentação oficial)
        
        // Verificar persona atual
        const [currentPersona] = await db.select().from(aiPersonas).where(eq(aiPersonas.id, personaId)).limit(1);
        
        if (!currentPersona) {
            console.error(`❌ Persona não encontrada: ${personaId}`);
            return;
        }
        
        console.log(`📋 Persona encontrada: ${currentPersona.name}`);
        console.log(`📋 Modelo atual: ${currentPersona.model}`);
        console.log(`📋 Provider: ${currentPersona.provider}`);
        
        if (currentPersona.model !== oldModel && currentPersona.model !== 'gemini-1.5-flash') {
            console.log(`⚠️  Modelo atual (${currentPersona.model}) não é ${oldModel}. Continuando mesmo assim...`);
        }
        
        if (currentPersona.provider !== 'GEMINI') {
            console.error(`❌ Persona não é GEMINI (Provider: ${currentPersona.provider})`);
            return;
        }
        
        // Atualizar modelo
        const [updatedPersona] = await db.update(aiPersonas)
            .set({ model: newModel })
            .where(eq(aiPersonas.id, personaId))
            .returning();
        
        if (!updatedPersona) {
            console.error('❌ Falha ao atualizar persona');
            return;
        }
        
        console.log(`✅ Persona atualizada com sucesso!`);
        console.log(`📋 Novo modelo: ${updatedPersona.model}`);
        console.log(`📋 Persona: ${updatedPersona.name}`);
        console.log(`📋 ID: ${updatedPersona.id}`);
        
    } catch (error) {
        console.error('❌ Erro ao atualizar modelo:', error);
        throw error;
    }
}

// Executar script
updateGeminiModel()
    .then(() => {
        console.log('✅ Script executado com sucesso!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Erro ao executar script:', error);
        process.exit(1);
    });
