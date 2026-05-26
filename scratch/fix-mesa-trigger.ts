import { db } from '../src/lib/db';
import { automationFlows } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const flowId = '84de750c-3b59-492a-9553-67f1f45192dc';
  
  const [flow] = await db.select().from(automationFlows).where(eq(automationFlows.id, flowId));
  if (!flow) { console.log('Flow not found'); process.exit(); }
  
  const flowData = flow.flowData as any;
  const nodes = (flowData?.nodes || []) as any[];
  const executionLogic = (flow.executionLogic || []) as any[];
  
  let modified = false;
  
  // Fix trigger keyword - remove invisible unicode characters
  const fixKeyword = (kw: string) => kw.replace(/[\u2060\u200B\u200C\u200D\uFEFF\u00A0]/g, '').trim();
  
  for (const node of nodes) {
    if (node.type === 'trigger' && node.data?.keyword) {
      const old = node.data.keyword;
      node.data.keyword = fixKeyword(old);
      if (old !== node.data.keyword) {
        console.log(`Fixed keyword: "${old.split('').map((c: string) => '0x' + c.charCodeAt(0).toString(16)).join(' ')}" -> "${node.data.keyword}"`);
        modified = true;
      }
    }
  }
  
  for (const step of executionLogic) {
    if (step.type === 'trigger' && step.data?.keyword) {
      const old = step.data.keyword;
      step.data.keyword = fixKeyword(old);
      if (old !== step.data.keyword) {
        console.log(`Fixed executionLogic trigger keyword`);
        modified = true;
      }
    }
  }
  
  if (modified) {
    await db.update(automationFlows)
      .set({ flowData: { ...flowData, nodes }, executionLogic: executionLogic as any })
      .where(eq(automationFlows.id, flowId));
    console.log('Saved!');
  } else {
    console.log('No changes needed');
  }
  
  // Verify
  const [updated] = await db.select().from(automationFlows).where(eq(automationFlows.id, flowId));
  const updatedNodes = ((updated.flowData as any)?.nodes || []) as any[];
  const trigger = updatedNodes.find((n: any) => n.type === 'trigger');
  console.log('Trigger keyword after fix:', JSON.stringify(trigger?.data?.keyword));
  
  process.exit(0);
}

main().catch(console.error);
