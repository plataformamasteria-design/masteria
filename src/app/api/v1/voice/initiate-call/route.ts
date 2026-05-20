import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { api4comService } from '@/lib/api4com-service';
import { db } from '@/lib/db';
import { voiceDeliveryReports } from '@/lib/db/schema';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function normalizePhoneNumber(phone: string): string {
  // Remove spaces, dashes, parentheses, dots
  let cleaned = phone.replace(/[\s\-().]/g, '');
  
  // Remove all non-digits except + at start
  const startsWithPlus = cleaned.startsWith('+');
  if (startsWithPlus) {
    cleaned = '+' + cleaned.substring(1).replace(/\D/g, '');
  } else {
    cleaned = cleaned.replace(/\D/g, '');
  }
  
  // Remove leading zeros (trunk prefix) - e.g., 011 becomes 11
  while (cleaned.replace(/^\+/, '').startsWith('0')) {
    cleaned = cleaned.startsWith('+') 
      ? '+' + cleaned.substring(1).substring(1)
      : cleaned.substring(1);
  }
  
  // Extract just the digits for processing
  const digits = cleaned.replace(/\D/g, '');
  
  // If it already starts with 55 (country code), check if it's valid
  if (digits.startsWith('55')) {
    // Remove country code and check length
    const withoutCountry = digits.substring(2);
    // Brazil numbers should be 10 (landline) or 11 (mobile) digits after country code
    // 10 digits: AABBBBBBB (AA=DDD, B=number)
    // 11 digits: AABCCCCCCC (AA=DDD, B=9, C=number)
    if (withoutCountry.length === 10 || withoutCountry.length === 11) {
      return '+' + digits;
    }
    // If length is wrong but has 55, try removing extra digits
    if (withoutCountry.length > 11) {
      // Try removing duplicates or extras from the start
      const cleaned_digits = withoutCountry.replace(/^(\d)\1+/, '$1');
      if (cleaned_digits.length === 10 || cleaned_digits.length === 11) {
        return '+55' + cleaned_digits;
      }
    }
  } else if (digits.length === 10 || digits.length === 11) {
    // Number without country code - add it
    return '+55' + digits;
  }
  
  // Fallback: just add +55 if it doesn't have it
  if (!digits.startsWith('55')) {
    return '+55' + digits;
  }
  
  return '+' + digits;
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    const body = await request.json();
    const { phoneNumber, customerName, contactId } = body;
    
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Número de telefone é obrigatório' },
        { status: 400 }
      );
    }

    const formattedNumber = normalizePhoneNumber(phoneNumber);

    logger.info('Iniciando ligação via API4COM', {
      phoneNumber: formattedNumber,
      customerName
    });

    // Dispara a chamada na API4COM
    const callResult = await api4comService.initiateClickToCall(companyId, formattedNumber);

    // Registra a tentativa no banco de dados para histórico (usando null para voiceAgentId, pois agora é chamada humana)
    if (contactId) {
      try {
        await db.insert(voiceDeliveryReports).values({
          contactId: contactId,
          voiceAgentId: null, // Sem agente de IA
          providerCallId: callResult.call_id || callResult.id || 'api4com-call', // Ajuste conforme a resposta real da api4com
          status: 'INITIATED',
          callOutcome: 'pending',
          attemptNumber: 1,
          sentAt: new Date(),
        });
        logger.info('Voice delivery report criado para chamada direta (API4COM)', { contactId });
      } catch (dbError) {
        logger.warn('Falha ao criar voice delivery report', { error: dbError });
      }
    }

    return NextResponse.json({
      success: true,
      data: callResult,
      message: `Chamada iniciada para ${customerName || phoneNumber}. O ramal irá tocar.`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao iniciar chamada';
    logger.error('Erro ao iniciar chamada via API4COM', { error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
