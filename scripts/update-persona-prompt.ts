
import { db } from '../src/lib/db';
import { aiPersonas } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const personaId = '08890caf-d926-419f-8670-989147e688bc';
  
  const persona = await db.query.aiPersonas.findFirst({
    where: eq(aiPersonas.id, personaId),
  });

  if (!persona) {
    console.error('Persona not found');
    process.exit(1);
  }

  console.log('Persona found:', persona);
  let prompt = persona.basePrompt || '';

  // Add the anti-loop instruction if not present
  const antiLoopRule = `
21 — CONTINUIDADE DE CONVERSA (ANTI-RESTART)
tags: [context, memory]
content: |

CRÍTICO: Verifique o histórico de mensagens antes de responder.
Se o usuário disser "Olá", "Oi" ou similar, MAS a conversa já estiver em andamento (mensagens anteriores recentes), NÃO reinicie o fluxo e NÃO envie a mensagem de boas-vindas novamente.
Responda algo como "Olá novamente! Continuando..." ou apenas responda à última pergunta.
NUNCA repita a mensagem de apresentação se ela já foi enviada na conversa.
`;

  if (!prompt.includes('ANTI-RESTART')) {
    prompt += antiLoopRule;
    await db.update(aiPersonas).set({ basePrompt: prompt }).where(eq(aiPersonas.id, personaId));
    console.log('✅ Persona prompt updated with Anti-Restart rule.');
  } else {
    console.log('ℹ️ Persona prompt already contains Anti-Restart rule.');
  }

  process.exit(0);
}

main().catch(console.error);
