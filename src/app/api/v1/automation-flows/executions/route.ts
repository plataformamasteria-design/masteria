// src/app/api/v1/automation-flows/executions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { automationFlowExecutions, automationFlows, automationExecutionLogs, contacts } from '@/lib/db/schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { getUserSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const companyId = session.user.companyId;
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
        const offset = (page - 1) * limit;
        const status = searchParams.get('status');
        const flowId = searchParams.get('flowId');

        const conditions = [eq(automationFlowExecutions.companyId, companyId)];

        if (status && status !== 'all') {
            conditions.push(eq(automationFlowExecutions.status, status));
        }

        if (flowId && flowId !== 'all') {
            conditions.push(eq(automationFlowExecutions.flowId, flowId));
        }

        const executions = await db.select({
            id: automationFlowExecutions.id,
            status: automationFlowExecutions.status,
            startedAt: automationFlowExecutions.startedAt,
            finishedAt: automationFlowExecutions.finishedAt,
            error: automationFlowExecutions.error,
            flowName: automationFlows.name,
            contactName: contacts.name,
            contactPhone: contacts.phone,
        })
            .from(automationFlowExecutions)
            .leftJoin(automationFlows, eq(automationFlowExecutions.flowId, automationFlows.id))
            .leftJoin(contacts, eq(automationFlowExecutions.contactId, contacts.id))
            .where(and(...conditions))
            .orderBy(desc(automationFlowExecutions.startedAt))
            .limit(limit)
            .offset(offset);

        // Buscar logs detalhados de cada execução
        const executionIds = executions.map(e => e.id);
        let logsByExecution: Record<string, any[]> = {};

        if (executionIds.length > 0) {
            const logs = await db.select({
                id: automationExecutionLogs.id,
                executionId: automationExecutionLogs.executionId,
                nodeId: automationExecutionLogs.nodeId,
                nodeType: automationExecutionLogs.nodeType,
                status: automationExecutionLogs.status,
                message: automationExecutionLogs.message,
                inputData: automationExecutionLogs.inputData,
                outputData: automationExecutionLogs.outputData,
                durationMs: automationExecutionLogs.durationMs,
                createdAt: automationExecutionLogs.createdAt,
            })
                .from(automationExecutionLogs)
                .where(inArray(automationExecutionLogs.executionId, executionIds))
                .orderBy(asc(automationExecutionLogs.createdAt));

            // Agrupar logs por executionId
            for (const log of logs) {
                if (!logsByExecution[log.executionId]) {
                    logsByExecution[log.executionId] = [];
                }
                logsByExecution[log.executionId].push(log);
            }
        }

        // Montar resultado com logs incluídos
        const executionsWithLogs = executions.map(exec => ({
            ...exec,
            logs: logsByExecution[exec.id] || [],
        }));

        // Count total
        const totalResult = await db.select({ count: sql<number>`count(*)` })
            .from(automationFlowExecutions)
            .where(and(...conditions));

        const total = totalResult[0]?.count || 0;

        return NextResponse.json({
            executions: executionsWithLogs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('[Executions API Error]:', error);
        return NextResponse.json({ error: 'Erro ao buscar execuções.' }, { status: 500 });
    }
}
