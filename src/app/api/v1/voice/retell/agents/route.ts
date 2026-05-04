import { NextRequest, NextResponse } from 'next/server';
import { retellService, CreateAgentParams } from '@/lib/retell-service';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const createAgentSchema = z.object({
  agent_name: z.string().min(1, 'Nome do agente é obrigatório'),
  voice_id: z.string().min(1, 'Voice ID é obrigatório'),
  language: z.string().optional(),
  response_engine: z.object({
    type: z.string(),
    llm_id: z.string().optional(),
  }).optional(),
  webhook_url: z.string().url().optional(),
  begin_message: z.string().optional(),
});

export async function GET() {
  try {
    if (!retellService.isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Retell API não configurada' },
        { status: 503 }
      );
    }

    const agents = await retellService.listAgents();

    return NextResponse.json({
      success: true,
      data: agents,
    });
  } catch (error) {
    logger.error('Erro ao listar agentes Retell', { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { success: false, error: 'Falha ao listar agentes', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!retellService.isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Retell API não configurada' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const validation = createAgentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const params: CreateAgentParams = validation.data;
    const agent = await retellService.createAgent(params);

    logger.info('Agente Retell criado', { agentId: agent.agent_id, agentName: agent.agent_name });

    return NextResponse.json({
      success: true,
      data: agent,
    }, { status: 201 });
  } catch (error) {
    logger.error('Erro ao criar agente Retell', { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { success: false, error: 'Falha ao criar agente', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
