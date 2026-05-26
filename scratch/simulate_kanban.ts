import { db } from '../src/lib/db';
import { moveLeadToStage } from '../src/lib/kanban/move-lead-to-stage';
import { startOutboundConversationAction } from '../src/app/actions/chat';
import { kanbanLeads, kanbanBoards, connections, contacts } from '../src/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function main() {
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'; // Empresa de Desenvolvimento Master
  const leadId = 'c853067d-92e9-47e6-b5c0-00947bb202cf'; // Lead for Deivid Rodrigues (5588920008007)
  const contactId = '1141d685-1c51-4a2f-bab4-ad5e3bbb71b8';
  
  // Find connection "Anderson"
  const conns = await db.select().from(connections).where(eq(connections.companyId, companyId));
  const anderson = conns.find(c => (c.config_name || '').toLowerCase().includes('anderson'));
  
  if (!anderson) {
      console.log('Connection Anderson not found!');
  } else {
      console.log(`Connection Anderson found: ${anderson.id}`);
  }

  console.log(`\n--- Test 1: Mover Lead de Etapa ---`);
  const [lead] = await db.select().from(kanbanLeads).where(eq(kanbanLeads.id, leadId));
  const [board] = await db.select().from(kanbanBoards).where(eq(kanbanBoards.id, lead.boardId));
  
  const stages = board.stages as any[];
  const currentStageId = lead.stageId;
  const newStage = stages.find(s => s.id !== currentStageId);
  
  if (!newStage) {
      console.log('No other stages in board to move to.');
  } else {
      console.log(`Attempting to move lead to stage: ${newStage.id} (${newStage.title})`);
      const moveRes = await moveLeadToStage({
          leadId,
          newStageId: newStage.id,
          companyId
      });
      console.log(`Move result:`, moveRes);
  }
  
  // Mock session functions for action test
  console.log(`\n--- Test 2: Iniciar Chat ---`);
  // O Mock foi removido pq no startOutbound eu teria q usar Jest, entao só vou chamar a logica real
  // ... let's just see test 1 first

  process.exit(0);
}

main().catch(console.error);
