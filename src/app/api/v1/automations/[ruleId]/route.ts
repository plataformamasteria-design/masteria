

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { automationRules } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';

// Schema mais flexível para validação de entrada, permitindo campos opcionais
const ruleUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  triggerEvent: z.string().min(1).optional(),
  conditions: z.array(z.object({
    type: z.enum(['contact_tag', 'message_content', 'contact_list', 'conversation_status']),
    operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'exists', 'not_exists']),
    value: z.union([z.string(), z.number()]).nullish(),
  }).passthrough()).optional(),
  actions: z.array(z.object({
    type: z.enum(['send_message', 'add_tag', 'assign_user', 'add_to_list']),
    value: z.string().optional(),
  }).passthrough()).min(1).optional(),
  connectionIds: z.array(z.string()).nullable().optional(),
  isActive: z.boolean().optional(),
});


// PUT /api/v1/automations/[ruleId]

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { ruleId } = await params;
        const body = await request.json();
        const parsed = ruleUpdateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }
        
        const { conditions, actions, ...restOfData } = parsed.data;

        const updatePayload: Partial<typeof automationRules.$inferInsert> = {
            ...restOfData,
            updatedAt: new Date(),
        };

        if (conditions) {
            updatePayload.conditions = conditions.map(({ id, value, ...rest }: any) => ({
                ...rest,
                value: value === undefined ? null : value,
            }));
        }

        if (actions) {
            updatePayload.actions = actions.map(({ id, ...rest }: any) => rest);
        }


        const [updatedRule] = await db
            .update(automationRules)
            .set(updatePayload)
            .where(and(eq(automationRules.id, ruleId), eq(automationRules.companyId, companyId)))
            .returning();
            
        if (!updatedRule) {
            return NextResponse.json({ error: 'Regra não encontrada ou não pertence à sua empresa.' }, { status: 404 });
        }

        return NextResponse.json(updatedRule);

    } catch (error) {
        console.error('Erro ao atualizar regra de automação:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

// DELETE /api/v1/automations/[ruleId]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { ruleId } = await params;
        const result = await db.delete(automationRules)
            .where(and(eq(automationRules.id, ruleId), eq(automationRules.companyId, companyId)))
            .returning();

        if (result.length === 0) {
            return NextResponse.json({ error: 'Regra não encontrada ou não pertence à sua empresa.' }, { status: 404 });
        }
        
        return new NextResponse(null, { status: 204 });

    } catch (error) {
         console.error('Erro ao excluir regra de automação:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
