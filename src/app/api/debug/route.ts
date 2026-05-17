import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { automationFlows, automationNodes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET() {
    try {
        const flow = await db.query.automationFlows.findFirst({
            where: eq(automationFlows.id, '8a11daba-6795-43f5-8c72-cdb59ec6f11e')
        });

        if (!flow) {
            return NextResponse.json({ error: 'Flow not found' });
        }

        const visualData = typeof flow.visualData === 'string' ? JSON.parse(flow.visualData) : flow.visualData;
        
        const nodesData = await db.query.automationNodes.findMany({
            where: eq(automationNodes.automationId, '8a11daba-6795-43f5-8c72-cdb59ec6f11e')
        });

        return NextResponse.json({
            id: flow.id,
            visualData_nodes: visualData?.nodes?.map((n: any) => ({
                id: n.id,
                type: n.type,
                learning_notes: n.data?.learning_notes,
                config_notes: n.data?.config?.learning_notes
            })),
            db_nodes: nodesData.map(n => ({
                id: n.id,
                type: n.nodeType,
                learning_notes: (n.config as any)?.learning_notes
            })),
            executionLogic: flow.executionLogic
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        const dbNode = await db.query.automationNodes.findFirst({
            where: and(
                eq(automationNodes.automationId, body.ruleId),
                eq(automationNodes.id, body.nodeId)
            )
        });

        if (dbNode) {
            const updatedConfig = { ...(dbNode.config as any) || {} };
            updatedConfig.learning_notes = body.notes;
            
            await db.update(automationNodes)
                .set({ config: updatedConfig })
                .where(and(
                    eq(automationNodes.automationId, body.ruleId),
                    eq(automationNodes.id, body.nodeId)
                ));
            
            return NextResponse.json({ success: true, oldConfig: dbNode.config, newConfig: updatedConfig });
        }
        
        return NextResponse.json({ error: 'Node not found' });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
