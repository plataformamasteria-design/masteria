import { db } from '../src/lib/db';
import { automationFlows } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';

async function run() {
    const flow = await db.query.automationFlows.findFirst({
        where: eq(automationFlows.id, '8a11daba-6795-43f5-8c72-cdb59ec6f11e')
    });
    
    if (flow) {
        const visualData = typeof flow.visualData === 'string' ? JSON.parse(flow.visualData) : flow.visualData;
        const aiNode = visualData?.nodes?.find((n: any) => n.id === 'ai_agent_1778963902000');
        fs.writeFileSync('scratch/node_data.json', JSON.stringify(aiNode.data, null, 2), 'utf-8');
    }
    process.exit(0);
}
run();
