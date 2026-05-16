import { db } from './src/lib/db';
import * as schema from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    try {
        const id = 'e47dc1f0-2be5-4023-89a3-b06f93b19c99';
        const flow = await db.query.automationFlows.findFirst({
            where: eq(schema.automationFlows.id, id)
        });

        if (!flow) {
            console.log("Flow not found");
            return;
        }

        const visualData = typeof flow.visualData === 'string' ? JSON.parse(flow.visualData) : flow.visualData;
        
        visualData.nodes.forEach((n: any) => {
            if (n.type === 'ai_agent' || n.type === 'ai') {
                console.log("Node ID:", n.id);
                console.log("Learning Notes in DB:", n.data.learning_notes || n.data.config?.learning_notes || "NOT FOUND");
            }
        });

    } catch (e: any) {
        console.error("DB Query Error:", e.message);
    }
}
main();
