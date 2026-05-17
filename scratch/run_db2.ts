import { db } from '../src/lib/db';
import { automationNodes, automationFlows } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
    const flow = await db.query.automationFlows.findFirst({
        where: eq(automationFlows.id, '8a11daba-6795-43f5-8c72-cdb59ec6f11e')
    });
    
    if (flow) {
        const visualData = typeof flow.visualData === 'string' ? JSON.parse(flow.visualData) : flow.visualData;
        const aiNode = visualData?.nodes?.find((n: any) => n.id === 'ai_agent_1778963902000');
        console.log("VISUAL DATA AI NODE LEARNING NOTES:", aiNode?.data?.learning_notes);
    }
    
    const nodes = await db.query.automationNodes.findMany({
        where: eq(automationNodes.automationId, '8a11daba-6795-43f5-8c72-cdb59ec6f11e')
    });
    
    console.log("DB NODES COUNT:", nodes.length);
    nodes.forEach(n => {
        if (n.id === 'ai_agent_1778963902000') {
            console.log("DB NODE LEARNING NOTES:", (n.config as any)?.learning_notes);
        }
    });
    process.exit(0);
}
run();
