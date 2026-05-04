import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const RETELL_API_KEY = process.env.RETELL_API_KEY || '';

const syncVoiceSchema = z.object({
  voiceId: z.string().min(1, 'Voice ID é obrigatório'),
  agentId: z.string().min(1, 'Agent ID é obrigatório'),
});

export async function POST(request: NextRequest) {
  try {
    if (!RETELL_API_KEY) {
      return NextResponse.json(
        { error: 'Retell API não configurada' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const validation = syncVoiceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { voiceId, agentId } = validation.data;

    const response = await fetch(`https://api.retellai.com/update-agent/${agentId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voice_id: voiceId,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Failed to update Retell voice', { status: response.status, error: errorBody });
      return NextResponse.json(
        { error: 'Falha ao atualizar voz no Retell', details: errorBody },
        { status: response.status }
      );
    }

    const result = await response.json();

    logger.info('Voice synced to Retell', { 
      agentId: agentId,
      voiceId: result.voice_id,
    });

    return NextResponse.json({
      success: true,
      agentId: result.agent_id,
      voiceId: result.voice_id,
      agentName: result.agent_name,
      message: 'Voz atualizada com sucesso!',
    });
  } catch (error) {
    logger.error('Error syncing voice', { error });
    return NextResponse.json(
      { error: 'Falha ao sincronizar voz', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
