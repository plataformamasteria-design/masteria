import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { db } from '../src/lib/db';
import { automationFlows, automationNodes } from '../src/lib/db/schema';
import { and, eq } from 'drizzle-orm';

async function testUpdate() {
    const automationId = '41bc227d-cb09-485a-8bde-715bd0dc0eb7'; // Flow from the Master IA simulator. Wait, let me query an existing flow ID first.
    const companyId = 'f28e5adf-ce84-436b-94c5-cd3941f254b7';

    // 1. Get an existing flow ID
    const sampleFlow = await db.query.automationFlows.findFirst();
    
    if (!sampleFlow) {
        console.log("No flows found");
        return;
    }
    
    console.log("Found flow:", sampleFlow.id);
    
    const flowV4 = await db.query.automationFlows.findFirst({
        where: eq(automationFlows.id, sampleFlow.id)
    });

    if (!flowV4) throw new Error("Flow not found");

    const visualData = typeof flowV4.visualData === 'string' ? JSON.parse(flowV4.visualData) : flowV4.visualData as any;
    let nodeId = 'fake_node';
    if (visualData && visualData.nodes && visualData.nodes.length > 0) {
        nodeId = visualData.nodes[0].id;
    }
    
    const newPrompt = "Testing prompt";
    const newLearningNotes = "Testing notes";

    if (visualData && visualData.nodes) {
        const aiNode = visualData.nodes.find((n: any) => n.id === nodeId);
        if (aiNode) {
            aiNode.data = aiNode.data || {};
            aiNode.data.config = aiNode.data.config || {};
            
            aiNode.data.prompt = newPrompt;
            aiNode.data.system_message = newPrompt;
            aiNode.data.config.prompt = newPrompt;
            aiNode.data.config.system_message = newPrompt;
            
            aiNode.data.learning_notes = newLearningNotes;
            aiNode.data.config.learning_notes = newLearningNotes;
        }
    }

    let executionLogic = typeof flowV4.executionLogic === 'string' ? JSON.parse(flowV4.executionLogic) : flowV4.executionLogic as any[];
    if (executionLogic && Array.isArray(executionLogic)) {
        const aiStep = executionLogic.find((s: any) => s.id === nodeId);
        if (aiStep) {
            aiStep.data = aiStep.data || {};
            aiStep.data.config = aiStep.data.config || {};
            
            aiStep.data.prompt = newPrompt;
            aiStep.data.system_message = newPrompt;
            aiStep.data.config.prompt = newPrompt;
            aiStep.data.config.system_message = newPrompt;
            
            aiStep.data.learning_notes = newLearningNotes;
            aiStep.data.config.learning_notes = newLearningNotes;
        }
    }

    console.log("Attempting to update automationFlows");
    try {
        await db.update(automationFlows)
            .set({ visualData, executionLogic })
            .where(eq(automationFlows.id, sampleFlow.id));
        console.log("Update automationFlows success!");
    } catch (e: any) {
        console.error("Update automationFlows failed:", e.message);
    }
    
    console.log("Attempting to update automationNodes");
    try {
        const dbNode = await db.query.automationNodes.findFirst({
            where: and(eq(automationNodes.automationId, sampleFlow.id), eq(automationNodes.id, nodeId))
        });

        if (dbNode) {
            const updatedConfig = { ...(dbNode.config as any) || {} };
            updatedConfig.prompt = newPrompt;
            updatedConfig.system_message = newPrompt;
            updatedConfig.learning_notes = newLearningNotes;

            await db.update(automationNodes)
                .set({ config: updatedConfig })
                .where(and(eq(automationNodes.automationId, sampleFlow.id), eq(automationNodes.id, nodeId)));
            console.log("Update automationNodes success!");
        } else {
            console.log("dbNode not found, skipped");
        }
    } catch (e: any) {
        console.error("Update automationNodes failed:", e.message);
    }
}

testUpdate().then(() => process.exit(0)).catch(console.error);
