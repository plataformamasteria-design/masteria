import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { voiceAgents } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { getCompanyIdFromSession } from '@/app/actions';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { z } from 'zod';

const createAgentSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['inbound', 'outbound', 'transfer']),
  systemPrompt: z.string().min(1, 'System prompt é obrigatório'),
  firstMessage: z.string().optional(),
  voiceId: z.string().default('pt-BR-FranciscaNeural'),
  llmModel: z.string().default('gpt-4'),
  temperature: z.number().min(0).max(2).default(0.7),
  retellAgentId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let whereCondition = and(
      eq(voiceAgents.companyId, companyId),
      isNull(voiceAgents.archivedAt)
    );
    
    if (status && ['active', 'inactive'].includes(status)) {
      whereCondition = and(
        eq(voiceAgents.companyId, companyId),
        eq(voiceAgents.status, status),
        isNull(voiceAgents.archivedAt)
      );
    }

    const agents = await db.query.voiceAgents.findMany({
      where: whereCondition,
      orderBy: [desc(voiceAgents.createdAt)],
    });

    logger.info('Voice agents listed', { count: agents.length, status });

    return NextResponse.json({
      success: true,
      data: agents,
      total: agents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error listing voice agents', { error });
    return NextResponse.json(
      { error: 'Falha ao listar agentes de voz', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    
    const body = await request.json();
    const validation = createAgentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { name, type, systemPrompt, firstMessage, voiceId, llmModel, temperature, retellAgentId } = validation.data;

    const [newAgent] = await db.insert(voiceAgents).values({
      companyId,
      name,
      type,
      systemPrompt,
      firstMessage,
      voiceId,
      llmModel,
      temperature: temperature.toString(),
      retellAgentId,
      status: 'active',
    }).returning();

    if (!newAgent) {
      throw new Error('Failed to create agent');
    }
    
    logger.info('Voice agent created', { agentId: newAgent.id, name: newAgent.name });

    return NextResponse.json({
      success: true,
      data: newAgent,
      message: 'Agente criado com sucesso',
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  } catch (error) {
    logger.error('Error creating voice agent', { error });
    return NextResponse.json(
      { error: 'Falha ao criar agente de voz', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
