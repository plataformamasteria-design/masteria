import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { db } from '../src/lib/db';
import { kanbanBoards, kanbanStagePersonas, aiPersonas } from '../src/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  const boardId = '42000504-dd41-40d3-ae9e-5b3710c06b12';
  
  // Get board to see stages
  const board = await db.query.kanbanBoards.findFirst({
    where: eq(kanbanBoards.id, boardId),
  });
  
  if (!board) {
    console.log('Funnel not found.');
    process.exit(0);
  }
  
  console.log(`Funnel Name: ${board.name}`);
  console.log('Stages:', board.stages.map(s => ({ id: s.id, title: s.title })));
  
  // Get stage personas
  const stagePersonas = await db.query.kanbanStagePersonas.findMany({
    where: eq(kanbanStagePersonas.boardId, boardId),
  });
  
  console.log('\nStage Personas Map:');
  console.log(JSON.stringify(stagePersonas, null, 2));
  
  // Get persona details
  const personaIds = new Set<string>();
  stagePersonas.forEach(sp => {
    if (sp.activePersonaId) personaIds.add(sp.activePersonaId);
    if (sp.passivePersonaId) personaIds.add(sp.passivePersonaId);
  });
  
  if (personaIds.size === 0) {
    console.log('No personas configured for this funnel.');
    process.exit(0);
  }
  
  const personas = await db.query.aiPersonas.findMany({
    where: inArray(aiPersonas.id, Array.from(personaIds)),
  });
  
  console.log('\n--- Personas Configured ---');
  personas.forEach(p => {
    console.log(`\nID: ${p.id}`);
    console.log(`Nome: ${p.name}`);
    console.log(`Tipo: ${p.agentType}`);
    console.log(`\n--- System Prompt ---\n${p.systemPrompt}\n---------------------\n`);
  });
  
  // Print summary by stage
  console.log('\n--- Resumo por Estágio ---');
  for (const stage of board.stages) {
    const sp = stagePersonas.find(sp => sp.stageId === stage.id);
    const activePersona = personas.find(p => p.id === sp?.activePersonaId);
    const passivePersona = personas.find(p => p.id === sp?.passivePersonaId);
    
    console.log(`\nEstágio: ${stage.title}`);
    console.log(`- Robô Ativo: ${activePersona ? activePersona.name : 'Nenhum'}`);
    console.log(`- Robô Passivo: ${passivePersona ? passivePersona.name : 'Nenhum'}`);
  }
  
  process.exit(0);
}

main().catch(console.error);
