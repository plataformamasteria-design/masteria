// src/app/api/v1/leads/automation-sources/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
    kanbanLeads,
    automationFlowExecutions,
    automationFlows,
} from '@/lib/db/schema';
import { requireAuthOr401 } from '@/lib/api-auth-helper';
import { eq, and, inArray, desc } from 'drizzle-orm';

/**
 * GET /api/v1/leads/automation-sources?boardId=xxx
 *
 * Para cada contato presente em um funil Kanban, retorna qual automação
 * V4 processou aquele contato (última execução concluída/parada).
 *
 * Response: { contactId: string; flowId: string; flowName: string }[]
 *
 * Usado pelo Kanban para agrupar campos personalizados por automação de
 * origem de forma DIRETA (usando execution_log), não por tag do contato.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuthOr401();
        if ('status' in auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { companyId } = auth;

        const { searchParams } = new URL(req.url);
        const boardId = searchParams.get('boardId');
        if (!boardId) {
            return NextResponse.json({ error: 'boardId é obrigatório' }, { status: 400 });
        }

        // 1. Obter todos os contactIds presentes no funil
        const leads = await db
            .select({ contactId: kanbanLeads.contactId })
            .from(kanbanLeads)
            .where(
                and(
                    eq(kanbanLeads.boardId, boardId),
                    eq(kanbanLeads.companyId, companyId)
                )
            );

        if (leads.length === 0) return NextResponse.json([]);

        const contactIds = [...new Set(leads.map(l => l.contactId))];

        // 2. Para cada contactId, buscar a última execução de automação V4
        // Buscamos em lote e depois fazemos dedup no JS (mais eficiente que N queries)
        const executions = await db
            .select({
                contactId: automationFlowExecutions.contactId,
                flowId: automationFlowExecutions.flowId,
                startedAt: automationFlowExecutions.startedAt,
                flowName: automationFlows.name,
            })
            .from(automationFlowExecutions)
            .innerJoin(
                automationFlows,
                eq(automationFlowExecutions.flowId, automationFlows.id)
            )
            .where(
                and(
                    eq(automationFlowExecutions.companyId, companyId),
                    inArray(automationFlowExecutions.contactId, contactIds)
                )
            )
            .orderBy(desc(automationFlowExecutions.startedAt));

        // 3. Dedup: para cada contactId, manter apenas a execução mais recente
        const latestByContact = new Map<string, { flowId: string; flowName: string }>();
        for (const exec of executions) {
            if (!exec.contactId) continue;
            if (!latestByContact.has(exec.contactId)) {
                latestByContact.set(exec.contactId, {
                    flowId: exec.flowId,
                    flowName: exec.flowName,
                });
            }
        }

        const result = Array.from(latestByContact.entries()).map(([contactId, v]) => ({
            contactId,
            flowId: v.flowId,
            flowName: v.flowName,
        }));

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[/api/v1/leads/automation-sources]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
