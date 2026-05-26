import { db } from '../src/lib/db';
import { kanbanLeads } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { moveLeadToStage } from '../src/lib/kanban/move-lead-to-stage';
import { NextResponse } from 'next/server';

// Simulating the Route exactly
async function PUT(body: any, leadId: string, companyId: string) {
    try {
        const [leadVerification] = await db.select({ boardId: kanbanLeads.boardId })
            .from(kanbanLeads)
            .where(eq(kanbanLeads.id, leadId))
            .limit(1);

        if (!leadVerification) {
            return { error: 'Lead não encontrado.', status: 404 };
        }

        // Simulating boardVerification
        const [boardVerification] = await db.select({ id: kanbanLeads.boardId }) // Quick mock
            .from(kanbanLeads)
            .where(eq(kanbanLeads.companyId, companyId))
            .limit(1);
        
        if (!boardVerification) {
            return { error: 'Lead não pertence à sua empresa.', status: 403 };
        }

        const result = await moveLeadToStage({
            leadId,
            newStageId: body.stageId,
            companyId
        });

        if (!result.success) {
            return { error: result.error, status: 400 };
        }

        return { success: true, status: 200 };
    } catch (error) {
        return { error: 'Internal Server Error', status: 500 };
    }
}

async function main() {
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
  const leadId = 'c853067d-92e9-47e6-b5c0-00947bb202cf'; 
  const body = { stageId: '92a03f35-fb1c-4257-bc19-2b995380edd7' };

  console.log('Testing PUT Route Simulation...');
  const res = await PUT(body, leadId, companyId);
  console.log(res);

  process.exit(0);
}

main().catch(console.error);
