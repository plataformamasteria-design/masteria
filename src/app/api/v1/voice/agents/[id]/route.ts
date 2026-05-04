import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { voiceAgents } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { getCompanyIdFromSession } from '@/app/actions';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['inbound', 'outbound', 'transfer']).optional(),
  systemPrompt: z.string().min(1).optional(),
  firstMessage: z.string().optional(),
  voiceId: z.string().optional(),
  llmModel: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  retellAgentId: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { id } = await params;

    const agent = await db.query.voiceAgents.findFirst({
      where: and(
        eq(voiceAgents.id, id),
        eq(voiceAgents.companyId, companyId)
      ),
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agente não encontrado' },
        { status: 404 }
      );
    }

    logger.info('Voice agent fetched', { agentId: id });

    return NextResponse.json({
      success: true,
      data: agent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching voice agent', { error });
    return NextResponse.json(
      { error: 'Falha ao buscar agente de voz', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { id } = await params;

    const existingAgent = await db.query.voiceAgents.findFirst({
      where: and(
        eq(voiceAgents.id, id),
        eq(voiceAgents.companyId, companyId)
      ),
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: 'Agente não encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateAgentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const validatedData = validation.data;
    
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.type !== undefined) updateData.type = validatedData.type;
    if (validatedData.systemPrompt !== undefined) updateData.systemPrompt = validatedData.systemPrompt;
    if (validatedData.firstMessage !== undefined) updateData.firstMessage = validatedData.firstMessage;
    if (validatedData.voiceId !== undefined) updateData.voiceId = validatedData.voiceId;
    if (validatedData.llmModel !== undefined) updateData.llmModel = validatedData.llmModel;
    if (validatedData.temperature !== undefined) updateData.temperature = validatedData.temperature.toString();
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    if (validatedData.retellAgentId !== undefined) updateData.retellAgentId = validatedData.retellAgentId;

    const [updatedAgent] = await db.update(voiceAgents)
      .set(updateData)
      .where(and(
        eq(voiceAgents.id, id),
        eq(voiceAgents.companyId, companyId)
      ))
      .returning();

    logger.info('Voice agent updated', { agentId: id, updates: Object.keys(updateData) });

    return NextResponse.json({
      success: true,
      data: updatedAgent,
      message: 'Agente atualizado com sucesso',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error updating voice agent', { error });
    return NextResponse.json(
      { error: 'Falha ao atualizar agente de voz', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { id } = await params;

    const existingAgent = await db.query.voiceAgents.findFirst({
      where: and(
        eq(voiceAgents.id, id),
        eq(voiceAgents.companyId, companyId)
      ),
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: 'Agente não encontrado' },
        { status: 404 }
      );
    }

    await db.update(voiceAgents)
      .set({ 
        archivedAt: new Date(),
        status: 'inactive',
      })
      .where(and(
        eq(voiceAgents.id, id),
        eq(voiceAgents.companyId, companyId)
      ));

    logger.info('Voice agent deleted (archived)', { agentId: id });

    return NextResponse.json({
      success: true,
      message: 'Agente excluído com sucesso',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error deleting voice agent', { error });
    return NextResponse.json(
      { error: 'Falha ao excluir agente de voz', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
