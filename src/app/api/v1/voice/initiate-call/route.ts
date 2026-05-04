import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { retellService } from '@/lib/retell-service';
import { db } from '@/lib/db';
import { voiceAgents, voiceDeliveryReports } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+553322980007';

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
    const { phoneNumber, customerName, contactId, agentId, fromNumber } = body;
    
    const callerNumber = fromNumber && fromNumber.startsWith('+') 
      ? fromNumber 
      : TWILIO_PHONE_NUMBER;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Número de telefone é obrigatório' },
        { status: 400 }
      );
    }

    if (!retellService.isConfigured()) {
      return NextResponse.json(
        { error: 'Retell API não configurada. Configure RETELL_API_KEY.' },
        { status: 500 }
      );
    }

    let selectedAgentId = agentId;
    if (!selectedAgentId) {
      // Try to get agent from database first
      const dbAgents = await db
        .select()
        .from(voiceAgents)
        .where(and(
          eq(voiceAgents.companyId, companyId),
          eq(voiceAgents.status, 'active')
        ))
        .limit(1);

      if (dbAgents.length > 0) {
        const dbAgent = dbAgents[0];
        if (dbAgent) {
          selectedAgentId = dbAgent.retellAgentId || dbAgent.externalId || '';
          if (!selectedAgentId) {
            logger.warn('DB agent found but no Retell ID', { agentId: dbAgent.id });
          } else {
            logger.info('Using agent from database', { 
              agentId: selectedAgentId, 
              agentName: dbAgent.name 
            });
          }
        }
      }
      
      // If no agent from DB, or DB agent has no Retell ID, fetch from Retell API
      if (!selectedAgentId) {
        try {
          const retellAgents = await retellService.listAgents();
          
          if (retellAgents.length === 0) {
            return NextResponse.json(
              { error: 'Nenhum agente de voz disponível na Retell API.' },
              { status: 400 }
            );
          }
          
          // Prefer "Assistente-2" if available, otherwise use first published agent
          let selectedAgent = retellAgents.find(a => 
            a.agent_name === 'Assistente-2' && a.is_published
          );
          
          if (!selectedAgent) {
            // Try any published agent
            selectedAgent = retellAgents.find(a => a.is_published);
          }
          
          if (!selectedAgent) {
            // If no published agent, use first available (might fail but will give clear error)
            selectedAgent = retellAgents[0];
            logger.warn('No published agent found, using first available', { 
              agentName: selectedAgent?.agent_name,
              agentId: selectedAgent?.agent_id,
              isPublished: selectedAgent?.is_published
            });
          }
          
          if (selectedAgent) {
            selectedAgentId = selectedAgent.agent_id;
            logger.info('Using Retell agent from API', { 
              agentId: selectedAgentId, 
              agentName: selectedAgent.agent_name,
              isPublished: selectedAgent.is_published
            });
          } else {
            return NextResponse.json(
              { error: 'Nenhum agente de voz disponível. Crie um agente primeiro.' },
              { status: 400 }
            );
          }
        } catch (apiError) {
          const errorMsg = apiError instanceof Error ? apiError.message : 'Unknown error';
          logger.error('Error fetching agents from Retell API', { error: errorMsg });
          return NextResponse.json(
            { error: `Erro ao buscar agentes: ${errorMsg}` },
            { status: 500 }
          );
        }
      }
    }

    const formattedNumber = normalizePhoneNumber(phoneNumber);

    logger.info('Initiating Retell call', {
      phoneNumber: formattedNumber,
      customerName,
      agentId: selectedAgentId,
      fromNumber: callerNumber,
    });

    const call = await retellService.createPhoneCallWithVoicemailDetection({
      from_number: callerNumber,
      to_number: formattedNumber,
      override_agent_id: selectedAgentId,
      metadata: {
        contact_id: contactId || '',
        customer_name: customerName || '',
        company_id: companyId,
        source: 'contact_profile',
      },
    });

    if (contactId && call.call_id) {
      try {
        await db.insert(voiceDeliveryReports).values({
          contactId: contactId,
          voiceAgentId: selectedAgentId,
          providerCallId: call.call_id,
          status: 'INITIATED',
          callOutcome: 'pending',
          attemptNumber: 1,
          sentAt: new Date(),
        });
        logger.info('Voice delivery report created for direct call', { callId: call.call_id, contactId });
      } catch (dbError) {
        logger.warn('Failed to create voice delivery report', { error: dbError });
      }
    }

    logger.info('Retell call initiated successfully', {
      callId: call.call_id,
      status: call.call_status,
    });

    return NextResponse.json({
      success: true,
      callId: call.call_id,
      status: call.call_status,
      message: `Chamada iniciada para ${customerName || phoneNumber}`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao iniciar chamada';
    logger.error('Error initiating Retell call', { error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
