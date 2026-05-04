import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { automationFlows, automationFlowExecutions, automationExecutionLogs } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { processFlowExecution } from '@/lib/flow-engine';

/**
 * POST /api/v1/automation-flows/test-real
 * 
 * Executa o fluxo DE VERDADE (como N8N).
 * Cria a execução diretamente no DB e processa via flow-engine.
 * Não depende de isActive — sempre executa para testes.
 * 
 * Body: { flowId, companyId, initialVars?, contactId? }
 */
export async function POST(req: NextRequest) {
    const start = Date.now();

    try {
        const body = await req.json();
        const { flowId, companyId, initialVars = {}, contactId: rawContactId } = body;

        if (!flowId || !companyId) {
            return NextResponse.json(
                { success: false, error: 'flowId e companyId são obrigatórios' },
                { status: 400 }
            );
        }

        console.log(`[test-real] 🔥 Starting real execution for flow: ${flowId}`);

        // Buscar fluxo sem filtrar por isActive (é teste)
        const flow = await db.query.automationFlows.findFirst({
            where: eq(automationFlows.id, flowId),
        });

        if (!flow) {
            console.error(`[test-real] ❌ Flow not found: ${flowId}`);
            return NextResponse.json(
                { success: false, error: `Fluxo não encontrado: ${flowId}` },
                { status: 404 }
            );
        }

        if (!flow.executionLogic) {
            return NextResponse.json(
                { success: false, error: 'Fluxo sem lógica de execução. Publique o fluxo primeiro.' },
                { status: 400 }
            );
        }

        // Resolver contactId — must be valid UUID or null (FK to contacts)
        // Phone/email is stored in initialVars for lookup_lead to resolve
        const contactId: string | null = null;

        console.log(`[test-real] 📋 Flow: ${flow.name}, Contact Phone: ${initialVars.contact_phone || initialVars.phone || 'none'}`);
        console.log(`[test-real] 📦 InitialVars keys:`, Object.keys(initialVars));

        // Criar execução diretamente no DB
        const [execution] = await db.insert(automationFlowExecutions).values({
            flowId,
            companyId: flow.companyId, // Usar companyId do fluxo, não do request
            contactId,
            status: 'running',
            variables: { vars: initialVars },
        }).returning();

        console.log(`[test-real] 📝 Execution created: ${execution.id}`);

        // Processar via flow-engine
        try {
            await processFlowExecution(execution.id, flow.executionLogic as any);
        } catch (engineError: any) {
            console.error(`[test-real] ❌ Flow engine error:`, engineError);
            await db.update(automationFlowExecutions)
                .set({ status: 'failed', error: String(engineError), finishedAt: new Date() })
                .where(eq(automationFlowExecutions.id, execution.id));
        }

        // Buscar execução atualizada + logs
        const updatedExecution = await db.query.automationFlowExecutions.findFirst({
            where: eq(automationFlowExecutions.id, execution.id),
        });

        const logs = await db
            .select()
            .from(automationExecutionLogs)
            .where(eq(automationExecutionLogs.executionId, execution.id))
            .orderBy(automationExecutionLogs.createdAt);

        const executionTime = Date.now() - start;

        console.log(`[test-real] ✅ Finished in ${executionTime}ms — Status: ${updatedExecution?.status}, Logs: ${logs.length}`);

        return NextResponse.json({
            success: true,
            executionId: execution.id,
            status: updatedExecution?.status || 'unknown',
            error: updatedExecution?.error || null,
            logs: logs.map(l => ({
                nodeId: l.nodeId,
                nodeType: (l as any).nodeType || null,
                status: l.status,
                message: l.message,
                inputData: (l as any).inputData || null,
                outputData: (l as any).outputData || null,
                durationMs: (l as any).durationMs || null,
                createdAt: l.createdAt,
            })),
            executionTime,
            contactId,
            flowName: flow.name,
        });

    } catch (error: any) {
        console.error('[test-real] Fatal error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Erro interno' },
            { status: 500 }
        );
    }
}
