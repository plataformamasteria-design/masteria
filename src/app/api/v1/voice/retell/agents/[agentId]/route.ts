import { NextRequest, NextResponse } from 'next/server';
import { retellService, UpdateAgentParams } from '@/lib/retell-service';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const updateAgentSchema = z.object({
  agent_name: z.string().min(1).optional(),
  voice_id: z.string().min(1).optional(),
  language: z.string().optional(),
  webhook_url: z.string().url().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    if (!retellService.isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Retell API não configurada' },
        { status: 503 }
      );
    }

    const { agentId } = await params;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Agent ID é obrigatório' },
        { status: 400 }
      );
    }

    const agent = await retellService.getAgent(agentId);

    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    logger.error('Erro ao buscar agente Retell', { error: error instanceof Error ? error.message : error, agentId: agentId });
    return NextResponse.json(
      { success: false, error: 'Falha ao buscar agente', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    if (!retellService.isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Retell API não configurada' },
        { status: 503 }
      );
    }

    const { agentId } = await params;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Agent ID é obrigatório' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateAgentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const updateParams: UpdateAgentParams = validation.data;
    const agent = await retellService.updateAgent(agentId, updateParams);

    logger.info('Agente Retell atualizado', { agentId, agentName: agent.agent_name });

    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    logger.error('Erro ao atualizar agente Retell', { error: error instanceof Error ? error.message : error, agentId: agentId });
    return NextResponse.json(
      { success: false, error: 'Falha ao atualizar agente', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    if (!retellService.isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Retell API não configurada' },
        { status: 503 }
      );
    }

    const { agentId } = await params;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Agent ID é obrigatório' },
        { status: 400 }
      );
    }

    await retellService.deleteAgent(agentId);

    logger.info('Agente Retell deletado', { agentId });

    return NextResponse.json({
      success: true,
      message: 'Agente deletado com sucesso',
    });
  } catch (error) {
    logger.error('Erro ao deletar agente Retell', { error: error instanceof Error ? error.message : error, agentId: agentId });
    return NextResponse.json(
      { success: false, error: 'Falha ao deletar agente', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
