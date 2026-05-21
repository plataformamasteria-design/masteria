import { db } from './src/lib/db';

async function run() {
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
  const flows = await db.query.automationFlows.findMany({
    where: (f, {eq, and}) => and(eq(f.companyId, companyId), eq(f.name, 'Formulario EDN 7 - Aplicação'))
  });
  
  if (flows.length === 0) {
    console.log("Flow not found");
    return;
  }
  
  const flowId = flows[0].id;
  
  const execs = await db.query.automationFlowExecutions.findMany({
    where: (e, {eq}) => eq(e.flowId, flowId),
    orderBy: (e, {desc}) => desc(e.startedAt),
    limit: 2
  });
  
  console.log('Executions:', execs.map(e => ({ id: e.id, status: e.status, error: e.error, startedAt: e.startedAt })));
  
  for (const exec of execs) {
    const logs = await db.query.automationExecutionLogs.findMany({
      where: (l, {eq}) => eq(l.executionId, exec.id),
      orderBy: (l, {asc}) => asc(l.createdAt)
    });
    
    console.log('\n--- Execution', exec.id, '---');
    logs.forEach(l => {
      console.log(`[${l.nodeType}] ${l.nodeId} -> ${l.status}: ${l.message}`);
      if(l.status === 'error' || l.nodeType === 'lookup_lead' || l.nodeType === 'update_contact') {
        console.log('  Input:', JSON.stringify(l.inputData?.config || {}));
        console.log('  Output:', JSON.stringify(l.outputData || {}));
      }
    });
  }
}

run().catch(console.error).finally(()=>process.exit(0));
