require('dotenv').config({ path: '.env.local' });
import fs from 'fs';
import path from 'path';

const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

async function main() {
  const { db } = await import('../src/lib/db');
  const { kanbanLeads, conversations, kanbanBoards } = await import('../src/lib/db/schema');
  const { eq, inArray, sql } = await import('drizzle-orm');

  const reportPath = path.join('scratch', 'reconciliation_report.json');
  const report: any[] = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  // Load all boards at once for stage object lookup
  const boards = await db.select().from(kanbanBoards);
  const boardStagesMap: Record<string, any[]> = {};
  for (const b of boards) {
    boardStagesMap[b.id] = (b.stages as any[]) || [];
  }

  // Load all leads that need changes (batch select, avoiding N+1)
  const stageUpdateRecords = report.filter(r => r.actions.some((a: any) => a.type === 'stage_update'));
  const agentUpdateRecords = report.filter(r => r.actions.some((a: any) => a.type === 'agent_update' || a.type === 'agent_reassign'));

  console.log(`Stage updates to apply: ${stageUpdateRecords.length}`);
  console.log(`Agent updates to apply: ${agentUpdateRecords.length}`);

  // Pre-fetch all affected leads in one query
  const allLeadIds = stageUpdateRecords.map(r => r.leadId);
  let leadsMap: Record<string, any> = {};
  if (allLeadIds.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < allLeadIds.length; i += chunkSize) {
      const chunk = allLeadIds.slice(i, i + chunkSize);
      const res = await db.select().from(kanbanLeads).where(inArray(kanbanLeads.id, chunk));
      for (const l of res) leadsMap[l.id] = l;
    }
  }

  // Pre-fetch all affected conversations
  const allConvIds = agentUpdateRecords.flatMap(r => r.actions.map((a: any) => a.convId).filter(Boolean));
  let convsMap: Record<string, any> = {};
  if (allConvIds.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < allConvIds.length; i += chunkSize) {
      const chunk = allConvIds.slice(i, i + chunkSize);
      const res = await db.select().from(conversations).where(inArray(conversations.id, chunk));
      for (const c of res) convsMap[c.id] = c;
    }
  }

  let appliedStageUpdates = 0;
  let appliedAgentUpdates = 0;
  let skipped = 0;
  let errors = 0;

  // --- BATCH STAGE UPDATES ---
  console.log('\nApplying stage corrections...');
  for (const record of stageUpdateRecords) {
    const stageAction = record.actions.find((a: any) => a.type === 'stage_update');
    if (!stageAction) continue;

    const lead = leadsMap[record.leadId];
    if (!lead) { skipped++; continue; }

    const stages = boardStagesMap[lead.boardId] || [];
    const newStageObj = stages.find((s: any) => s.id === stageAction.to) || null;

    try {
      await db.update(kanbanLeads)
        .set({
          stageId: stageAction.to,
          currentStage: newStageObj,
          lastStageChangeAt: new Date(),
        })
        .where(eq(kanbanLeads.id, record.leadId));
      appliedStageUpdates++;
    } catch (err: any) {
      errors++;
      console.error(`Stage update error for lead ${record.leadId}: ${err.message}`);
    }
  }
  console.log(`  Done: ${appliedStageUpdates} stage updates applied.`);

  // --- BATCH AGENT UPDATES ---
  // Group by (convId, toAgent) to minimize individual queries
  console.log('\nApplying agent corrections...');
  
  // Build list of (convId, newAgentId) pairs
  const agentUpdates: Array<{ convId: string; toAgent: string | null }> = [];
  for (const record of agentUpdateRecords) {
    for (const action of record.actions) {
      if (action.type !== 'agent_update' && action.type !== 'agent_reassign') continue;
      if (!action.convId) continue;
      agentUpdates.push({ convId: action.convId, toAgent: action.toAgent });
    }
  }

  // Group by same (toAgent) to batch
  const byAgent: Record<string, string[]> = {};
  for (const { convId, toAgent } of agentUpdates) {
    const key = toAgent || 'NULL';
    if (!byAgent[key]) byAgent[key] = [];
    byAgent[key].push(convId);
  }

  for (const [agentKey, convIds] of Object.entries(byAgent)) {
    const agentId = agentKey === 'NULL' ? null : agentKey;
    try {
      const chunkSize = 200;
      for (let i = 0; i < convIds.length; i += chunkSize) {
        const chunk = convIds.slice(i, i + chunkSize);
        await db.update(conversations)
          .set({ assignedTo: agentId })
          .where(inArray(conversations.id, chunk));
        appliedAgentUpdates += chunk.length;
      }
    } catch (err: any) {
      errors++;
      console.error(`Agent batch update error: ${err.message}`);
    }
  }
  console.log(`  Done: ${appliedAgentUpdates} agent updates applied.`);

  console.log('\n' + '='.repeat(60));
  console.log('EXECUTION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Stage corrections applied: ${appliedStageUpdates}`);
  console.log(`✅ Agent corrections applied: ${appliedAgentUpdates}`);
  console.log(`⏭️  Skipped (lead not found): ${skipped}`);
  console.log(`❌ Errors: ${errors}`);

  process.exit(0);
}

main().catch(console.error);
