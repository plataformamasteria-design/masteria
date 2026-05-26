import { db } from '../src/lib/db';
import { kanbanLeads, kanbanBoards } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const companyId = '763a89b7-164f-48c5-8765-98d0a147bc1d';
  const leadId = 'c853067d-92e9-47e6-b5c0-00947bb202cf'; 

  const [lead] = await db.select().from(kanbanLeads).where(eq(kanbanLeads.id, leadId));
  const [board] = await db.select().from(kanbanBoards).where(eq(kanbanBoards.id, lead.boardId));
  
  console.log(`Lead companyId: ${lead.companyId}`);
  console.log(`Board companyId: ${board.companyId}`);
  console.log(`Expected companyId: ${companyId}`);

  process.exit(0);
}

main().catch(console.error);
