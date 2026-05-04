import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { voiceAgents, voiceCalls } from '@/lib/db/schema';
import { eq, and, isNotNull, desc } from 'drizzle-orm';
import { z } from 'zod';

const twilioIncomingSchema = z.object({
  CallSid: z.string(),
  AccountSid: z.string().optional(),
  From: z.string(),
  To: z.string(),
  Called: z.string().optional(),
  Caller: z.string().optional(),
  CallStatus: z.string().optional(),
  Direction: z.string().optional(),
  ForwardedFrom: z.string().optional(),
  CallerCity: z.string().optional(),
  CallerState: z.string().optional(),
  CallerCountry: z.string().optional(),
  CallerZip: z.string().optional(),
  ToCity: z.string().optional(),
  ToState: z.string().optional(),
  ToCountry: z.string().optional(),
  ToZip: z.string().optional(),
  ApiVersion: z.string().optional(),
  StirVerstat: z.string().optional(),
});

type TwilioIncomingPayload = z.infer<typeof twilioIncomingSchema>;

interface RetellRegisterCallResponse {
  call_id: string;
  agent_id: string;
  call_status?: string;
  call_type?: string;
}

async function getPublishedAgentVersion(agentId: string, retellApiKey: string): Promise<number | null> {
  try {
    const response = await fetch('https://api.retellai.com/list-phone-numbers', {
      headers: { 'Authorization': `Bearer ${retellApiKey}` },
    });
    
    if (!response.ok) {
      logger.warn('[Inbound] Failed to fetch phone numbers for version lookup');
      return null;
    }
    
    const numbers = await response.json();
    const configuredNumber = numbers.find((n: any) => n.inbound_agent_id === agentId);
    
    if (configuredNumber?.inbound_agent_version) {
      logger.info('[Inbound] Found published agent version from phone number config', {
        version: configuredNumber.inbound_agent_version,
      });
      return configuredNumber.inbound_agent_version;
    }
    
    return null;
  } catch (error) {
    logger.warn('[Inbound] Error fetching published agent version', { error });
    return null;
  }
}

async function registerRetellCall(
  agentId: string,
  fromNumber: string,
  toNumber: string
): Promise<RetellRegisterCallResponse | null> {
  const retellApiKey = process.env.RETELL_API_KEY;
  
  if (!retellApiKey) {
    logger.error('[Inbound] RETELL_API_KEY not configured');
    return null;
  }

  try {
    const publishedVersion = await getPublishedAgentVersion(agentId, retellApiKey);
    
    const payload: Record<string, any> = {
      agent_id: agentId,
      from_number: fromNumber,
      to_number: toNumber,
      direction: 'inbound',
    };
    
    const versionToUse = publishedVersion || 10;
    payload.agent_version = versionToUse;
    
    logger.info('[Inbound] Registering call with Retell (Method 2 - Dial to SIP URI)', {
      payload,
    });
    
    const response = await fetch('https://api.retellai.com/v2/register-phone-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Inbound] Retell register call failed', {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const data = await response.json() as RetellRegisterCallResponse;
    logger.info('[Inbound] Retell call registered successfully', {
      callId: data.call_id,
      agentId: data.agent_id,
    });

    return data;
  } catch (error) {
    logger.error('[Inbound] Error registering Retell call', { error });
    return null;
  }
}

async function getActiveInboundVoiceAgent() {
  try {
    const agents = await db
      .select({
        id: voiceAgents.id,
        name: voiceAgents.name,
        companyId: voiceAgents.companyId,
        type: voiceAgents.type,
        status: voiceAgents.status,
        retellAgentId: voiceAgents.retellAgentId,
        systemPrompt: voiceAgents.systemPrompt,
        firstMessage: voiceAgents.firstMessage,
      })
      .from(voiceAgents)
      .where(
        and(
          eq(voiceAgents.type, 'inbound'),
          eq(voiceAgents.status, 'active'),
          isNotNull(voiceAgents.retellAgentId)
        )
      )
      .orderBy(desc(voiceAgents.createdAt))
      .limit(1);

    const agent = agents[0];
    if (!agent) {
      logger.info('[Inbound] No active inbound agent found in local database');
      return null;
    }

    logger.info('[Inbound] Found active inbound agent in local database', {
      agentId: agent.id,
      agentName: agent.name,
      retellAgentId: agent.retellAgentId,
      companyId: agent.companyId,
    });

    return agent;
  } catch (error) {
    logger.error('[Inbound] Error querying local database for inbound agent', { error });
    return null;
  }
}

async function logInboundCall(
  payload: TwilioIncomingPayload,
  agent: { id: string; companyId: string } | null,
  retellCallId?: string
) {
  try {
    if (!agent) return;

    await db.insert(voiceCalls).values({
      companyId: agent.companyId,
      agentId: agent.id,
      externalCallId: payload.CallSid,
      retellCallId: retellCallId || null,
      direction: 'inbound',
      fromNumber: payload.From,
      toNumber: payload.To,
      status: 'initiated',
      provider: 'retell',
      metadata: {
        callerCity: payload.CallerCity,
        callerState: payload.CallerState,
        callerCountry: payload.CallerCountry,
        forwardedFrom: payload.ForwardedFrom,
        stirVerstat: payload.StirVerstat,
      },
    });

    logger.info('[Inbound] Call logged to database', {
      callSid: payload.CallSid,
      retellCallId,
      agentId: agent.id,
    });
  } catch (error) {
    logger.warn('[Inbound] Failed to log call to database (non-blocking)', { error });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });
    
    logger.info('[Inbound] Twilio incoming call webhook received', { 
      callSid: body.CallSid,
      from: body.From,
      to: body.To,
      callerCity: body.CallerCity,
      callerCountry: body.CallerCountry,
    });

    const validation = twilioIncomingSchema.safeParse(body);
    
    if (!validation.success) {
      logger.warn('[Inbound] Twilio incoming webhook validation failed', { 
        errors: validation.error.flatten(),
        body: JSON.stringify(body).slice(0, 500),
      });
      return generateTwiMLResponse('Desculpe, não foi possível processar sua chamada.');
    }

    const payload: TwilioIncomingPayload = validation.data;

    const twimlResponse = await handleIncomingCall(payload);

    const processingTime = Date.now() - startTime;
    
    logger.info('[Inbound] Twilio incoming call webhook processed', { 
      callSid: payload.CallSid,
      from: payload.From,
      to: payload.To,
      processingTimeMs: processingTime,
    });

    return new NextResponse(twimlResponse, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    logger.error('[Inbound] Twilio incoming call webhook processing error', { error });
    return generateTwiMLResponse('Ocorreu um erro ao processar sua chamada. Por favor, tente novamente.');
  }
}

async function handleIncomingCall(payload: TwilioIncomingPayload): Promise<string> {
  logger.info('[Inbound] Processing incoming call', {
    callSid: payload.CallSid,
    from: payload.From,
    to: payload.To,
    callerLocation: `${payload.CallerCity || 'Unknown'}, ${payload.CallerState || ''}, ${payload.CallerCountry || ''}`.trim(),
  });

  const localAgent = await getActiveInboundVoiceAgent();

  if (localAgent && localAgent.retellAgentId) {
    logger.info('[Inbound] Registering call with Retell API...', { 
      agentId: localAgent.id, 
      retellAgentId: localAgent.retellAgentId,
      callSid: payload.CallSid,
    });

    const retellCall = await registerRetellCall(
      localAgent.retellAgentId,
      payload.From,
      payload.To
    );

    if (retellCall && retellCall.call_id) {
      // Method 2: Dial to SIP URI using LiveKit SIP server with UDP (default transport)
      // Try without explicit transport to let Twilio negotiate
      const sipUri = `sip:${retellCall.call_id}@5t4n6j0wnrl.sip.livekit.cloud`;
      logger.info('[Inbound] ✅ Call registered with Retell - Routing to SIP URI (Retell Method 2)', { 
        retellCallId: retellCall.call_id,
        agentId: localAgent.id,
        callSid: payload.CallSid,
        sipUri,
      });

      await logInboundCall(payload, localAgent, retellCall.call_id);
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://62863c59-d08b-44f5-a414-d7529041de1a-00-16zuyl87dp7m9.kirk.replit.dev';
      
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="60" action="${baseUrl}/api/v1/voice/webhooks/twilio/dial-callback">
    <Sip statusCallback="${baseUrl}/api/v1/voice/webhooks/twilio/sip-status" statusCallbackEvent="initiated ringing answered completed">${sipUri}</Sip>
  </Dial>
</Response>`;
    } else {
      logger.error('[Inbound] Failed to register call with Retell', {
        callSid: payload.CallSid,
        agentId: localAgent.retellAgentId,
      });
    }
  }

  logger.warn('[Inbound] No active inbound agent found or registration failed - returning voicemail response', {
    callSid: payload.CallSid,
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="pt-BR" voice="Polly.Camila">
    Olá! Bem-vindo ao Master IA. Infelizmente, não há agentes disponíveis no momento.
    Por favor, tente novamente mais tarde ou deixe uma mensagem após o sinal.
  </Say>
  <Record maxLength="120" action="/api/v1/voice/webhooks/twilio/recording" transcribe="true" />
</Response>`;
}

function generateTwiMLResponse(message: string): NextResponse {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="pt-BR" voice="Polly.Camila">${message}</Say>
  <Hangup />
</Response>`;
  
  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function GET() {
  const localAgent = await getActiveInboundVoiceAgent();
  
  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/voice/webhooks/twilio/incoming`
    : 'Not configured - set NEXT_PUBLIC_APP_URL';

  return NextResponse.json({
    success: true,
    webhook: 'twilio-incoming',
    status: 'active',
    description: 'Handles incoming Twilio calls and routes to Retell AI agent',
    timestamp: new Date().toISOString(),
    configuration: {
      webhookUrl,
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || 'Not configured',
      retellApiKeyConfigured: !!process.env.RETELL_API_KEY,
      localAgentConfigured: !!localAgent,
      localAgent: localAgent ? {
        id: localAgent.id,
        name: localAgent.name,
        retellAgentId: localAgent.retellAgentId,
        type: localAgent.type,
        status: localAgent.status,
      } : null,
      twimlMethod: 'Connect+Stream (WebSocket bidirectional audio)',
      retellWebSocketUrl: 'wss://api.retellai.com/audio-websocket/{call_id}',
    },
    instructions: {
      step1: 'Create an inbound voice agent in the Voice AI page with type="inbound" and status="active"',
      step2: 'Ensure the agent has a valid retellAgentId configured',
      step3: `Configure Twilio webhook: Go to Twilio Console > Phone Numbers > ${process.env.TWILIO_PHONE_NUMBER || 'your number'} > Voice Configuration`,
      step4: `Set "A call comes in" webhook URL to: ${webhookUrl}`,
      step5: 'Set HTTP method to POST',
      step6: 'Test by calling the Twilio phone number',
    },
  });
}
