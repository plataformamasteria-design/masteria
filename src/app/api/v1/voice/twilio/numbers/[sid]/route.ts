import { NextRequest, NextResponse } from 'next/server';
import { twilioService } from '@/lib/twilio-service';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const updateNumberSchema = z.object({
  voice_url: z.string().url().optional(),
  sms_url: z.string().url().optional(),
  friendly_name: z.string().min(1).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sid: string }> }
) {
  try {
    if (!twilioService.isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Twilio API não configurada' },
        { status: 503 }
      );
    }

    const { sid } = await params;

    if (!sid) {
      return NextResponse.json(
        { success: false, error: 'SID do número é obrigatório' },
        { status: 400 }
      );
    }

    const number = await twilioService.getPhoneNumber(sid);

    return NextResponse.json({
      success: true,
      data: number,
    });
  } catch (error) {
    logger.error('Erro ao buscar número Twilio', { error: error instanceof Error ? error.message : error, sid: sid });
    return NextResponse.json(
      { success: false, error: 'Falha ao buscar número de telefone', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sid: string }> }
) {
  try {
    if (!twilioService.isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Twilio API não configurada' },
        { status: 503 }
      );
    }

    const { sid } = await params;

    if (!sid) {
      return NextResponse.json(
        { success: false, error: 'SID do número é obrigatório' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateNumberSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const number = await twilioService.updatePhoneNumber(sid, validation.data);

    logger.info('Número Twilio atualizado', { sid, phoneNumber: number.phone_number });

    return NextResponse.json({
      success: true,
      data: number,
    });
  } catch (error) {
    logger.error('Erro ao atualizar número Twilio', { error: error instanceof Error ? error.message : error, sid: sid });
    return NextResponse.json(
      { success: false, error: 'Falha ao atualizar número de telefone', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
