// scripts/update-persona-to-free-model.ts
import { db } from '@/lib/db';
import { aiPersonas } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const PERSONA_ID = '71c7a1c6-8903-436a-b0c1-699a746af25c'; // EDN Atendimento - Antônio/Pablo
const NEW_MODEL = 'gemini-3-flash-preview'; // Modelo gratuito mais recente

async function main() {
  console.log('=== 🔄 ATUALIZANDO MODELO DA PERSONA PARA GRATUITO ===\n');
  console.log(`Persona ID: ${PERSONA_ID}`);
  console.log(`Modelo atual: gemini-2.5-flash-lite`);
  console.log(`Novo modelo: ${NEW_MODEL}\n`);

  try {
    // Buscar persona atual
    const persona = await db.query.aiPersonas.findFirst({
      where: eq(aiPersonas.id, PERSONA_ID),
    });

    if (!persona) {
      console.error('❌ Persona não encontrada');
      process.exit(1);
    }

    console.log('📋 DADOS ATUAIS DA PERSONA:');
    console.log(`   Nome: ${persona.name}`);
    console.log(`   Provider: ${persona.provider}`);
    console.log(`   Modelo atual: ${persona.model || 'N/A'}\n`);

    // Atualizar modelo
    await db.update(aiPersonas)
      .set({ model: NEW_MODEL })
      .where(eq(aiPersonas.id, PERSONA_ID));

    console.log('✅ Modelo atualizado com sucesso!\n');

    // Verificar atualização
    const updatedPersona = await db.query.aiPersonas.findFirst({
      where: eq(aiPersonas.id, PERSONA_ID),
    });

    console.log('📋 DADOS ATUALIZADOS:');
    console.log(`   Nome: ${updatedPersona?.name}`);
    console.log(`   Provider: ${updatedPersona?.provider}`);
    console.log(`   Modelo: ${updatedPersona?.model}\n`);

    console.log('✅ Atualização concluída!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao atualizar persona:', error);
    process.exit(1);
  }
}

main().catch(console.error);
