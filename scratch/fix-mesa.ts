import { db } from '../src/lib/db';
import { automationFlows } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const flowId = '84de750c-3b59-492a-9553-67f1f45192dc';
  
  const [flow] = await db.select().from(automationFlows).where(eq(automationFlows.id, flowId));
  if (!flow) { console.log('Flow not found'); process.exit(); }
  
  const flowData = (flow.flowData as any) || { nodes: [], edges: [] };
  const nodes = flowData.nodes || [];
  const edges = flowData.edges || [];
  const executionLogic = (flow.executionLogic || []) as any[];
  
  console.log('Nodes count:', nodes.length);
  console.log('Edges count:', edges.length);
  console.log('ExecLogic count:', executionLogic.length);
  
  let modified = false;
  
  // 1. Fix trigger keyword
  const fixKeyword = (kw: string) => kw.replace(/[\u2060\u200B\u200C\u200D\uFEFF\u00A0]/g, '').trim();
  
  for (const node of nodes) {
    if (node.type === 'trigger' && node.data?.keyword) {
      const old = node.data.keyword;
      node.data.keyword = fixKeyword(old);
      if (old !== node.data.keyword) {
        console.log('Fixed node trigger keyword to:', node.data.keyword);
        modified = true;
      }
    }
  }
  for (const step of executionLogic) {
    if (step.type === 'trigger' && step.data?.keyword) {
      const old = step.data.keyword;
      step.data.keyword = fixKeyword(old);
      if (old !== step.data.keyword) {
        console.log('Fixed exec logic trigger keyword to:', step.data.keyword);
        modified = true;
      }
    }
  }
  
  // 2. Fix disconnected delay in UI and ExecutionLogic
  const msgStep = executionLogic.find(s => s.id === 'send_message_1779804401055');
  const delayStep = executionLogic.find(s => s.id === 'delay_1779804455830');
  
  if (msgStep && delayStep) {
    if (!msgStep.nextSteps || msgStep.nextSteps.length === 0) {
      console.log('Fixing disconnected send_message in executionLogic...');
      msgStep.nextSteps = [delayStep.id];
      msgStep.connections = [{ target: delayStep.id }];
      modified = true;
    }
  }
  
  const edgeExists = edges.some((e: any) => e.source === 'send_message_1779804401055' && e.target === 'delay_1779804455830');
  if (!edgeExists && msgStep && delayStep) {
      console.log('Adding missing edge in UI graph...');
      edges.push({
          id: `e_send_message_1779804401055__delay_1779804455830`,
          type: "flow-edge",
          source: 'send_message_1779804401055',
          target: 'delay_1779804455830',
          animated: false,
          markerEnd: {
            type: "arrowclosed",
            color: "#cbd5e1",
            width: 8,
            height: 8
          }
      });
      modified = true;
  }
  
  // Connect delay to condition 
  const conditionStep = executionLogic.find(s => s.id === 'condition_1779804555602');
  if (delayStep && conditionStep) {
    if (!delayStep.nextSteps || delayStep.nextSteps.length === 0) {
       console.log('Fixing disconnected delay -> condition in executionLogic...');
       delayStep.nextSteps = [conditionStep.id];
       delayStep.connections = [{ target: conditionStep.id }];
       modified = true;
    }
  }

  const edge2Exists = edges.some((e: any) => e.source === 'delay_1779804455830' && e.target === 'condition_1779804555602');
  if (!edge2Exists && delayStep && conditionStep) {
      console.log('Adding missing edge delay -> condition in UI graph...');
      edges.push({
          id: `e_delay_1779804455830__condition_1779804555602`,
          type: "flow-edge",
          source: 'delay_1779804455830',
          target: 'condition_1779804555602',
          animated: false,
          markerEnd: {
            type: "arrowclosed",
            color: "#cbd5e1",
            width: 8,
            height: 8
          }
      });
      modified = true;
  }
  
  if (modified) {
    await db.update(automationFlows)
      .set({ flowData: { ...flowData, nodes, edges }, executionLogic })
      .where(eq(automationFlows.id, flowId));
      
    console.log('Successfully fixed automation data!');
  } else {
    console.log('No modifications needed.');
  }
  
  process.exit(0);
}

main().catch(console.error);
