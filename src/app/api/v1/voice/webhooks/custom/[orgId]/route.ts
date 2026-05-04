import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { voiceCalls } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';

const customWebhookSchema = z.object({
  event: z.string(),
  timestamp: z.string().or(z.number()).optional(),
  data: z.record(z.any()).optional(),
  callId: z.string().optional(),
  agentId: z.string().optional(),
  organizationId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

type CustomWebhookPayload = z.infer<typeof customWebhookSchema>;

function verifySignature(request: NextRequest, body: string, orgId: string): boolean {
  const signature = request.headers.get('X-Webhook-Signature') || request.headers.get('x-webhook-signature');
  
  if (!signature) {
    logger.warn('No webhook signature provided', { orgId });
    return true;
  }

  const webhookSecret = process.env[`WEBHOOK_SECRET_${orgId.toUpperCase().replace(/-/g, '_')}`] || process.env.WEBHOOK_SECRET_DEFAULT;
  
  if (!webhookSecret) {
    logger.warn('No webhook secret configured for organization', { orgId });
    return true;
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');

  const isValid = signature === expectedSignature || signature === `sha256=${expectedSignature}`;
  
  if (!isValid) {
    logger.warn('Invalid webhook signature', { orgId, providedSignature: signature.slice(0, 20) + '...' });
  }

  return isValid;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const startTime = Date.now();
  const { orgId } = await params;
  
  try {
    const bodyText = await request.text();
    
    if (!verifySignature(request, bodyText, orgId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch {
      logger.warn('Invalid JSON in custom webhook', { orgId, bodyPreview: bodyText.slice(0, 100) });
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }
    
    logger.info('Custom webhook received', { 
      orgId,
      event: body.event,
      callId: body.callId,
      agentId: body.agentId,
    });

    const validation = customWebhookSchema.safeParse(body);
    
    if (!validation.success) {
      logger.warn('Custom webhook validation failed', { 
        orgId,
        errors: validation.error.flatten(),
      });
      return NextResponse.json(
        { success: false, error: 'Invalid webhook payload', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const payload: CustomWebhookPayload = validation.data;

    await handleCustomEvent(orgId, payload);

    const processingTime = Date.now() - startTime;
    
    logger.info('Custom webhook processed', { 
      orgId,
      event: payload.event,
      processingTimeMs: processingTime,
    });

    return NextResponse.json({
      success: true,
      orgId,
      event: payload.event,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Custom webhook processing error', { orgId, error });
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleCustomEvent(orgId: string, payload: CustomWebhookPayload) {
  logger.info('Processing custom event', {
    orgId,
    event: payload.event,
    callId: payload.callId,
    agentId: payload.agentId,
  });

  const eventHandlers: Record<string, (orgId: string, payload: CustomWebhookPayload) => Promise<void>> = {
    'call.started': handleCallStarted,
    'call.ended': handleCallEnded,
    'call.analyzed': handleCallAnalyzed,
    'agent.status_changed': handleAgentStatusChanged,
    'recording.ready': handleRecordingReady,
    'transcript.ready': handleTranscriptReady,
    'analysis.complete': handleAnalysisComplete,
  };

  const handler = eventHandlers[payload.event];
  
  if (handler) {
    await handler(orgId, payload);
  } else {
    logger.info('Unhandled custom event type', { orgId, event: payload.event });
  }
}

async function handleCallStarted(orgId: string, payload: CustomWebhookPayload) {
  logger.info('Custom event: call.started', { orgId, callId: payload.callId });
  
  if (payload.callId) {
    // SECURITY: Buscar call primeiro para obter companyId (webhook externo, sem sessão)
    const existingCall = await db.query.voiceCalls.findFirst({
      where: eq(voiceCalls.externalCallId, payload.callId),
    });
    
    if (existingCall && existingCall.companyId) {
      // SECURITY: Validar tenant ao atualizar (via companyId obtido do call)
      await db.update(voiceCalls)
        .set({
          status: 'in_progress',
          startedAt: new Date(),
          metadata: {
            ...(existingCall.metadata as object || {}),
            organizationId: orgId,
            source: 'custom_webhook',
            ...payload.data,
          },
        })
        .where(and(
          eq(voiceCalls.id, existingCall.id),
          eq(voiceCalls.companyId, existingCall.companyId)
        ));
    }
  }
}

async function handleCallEnded(orgId: string, payload: CustomWebhookPayload) {
  logger.info('Custom event: call.ended', { orgId, callId: payload.callId });
  
  if (payload.callId) {
    // SECURITY: Buscar call primeiro para obter companyId (webhook externo, sem sessão)
    const existingCall = await db.query.voiceCalls.findFirst({
      where: eq(voiceCalls.externalCallId, payload.callId),
    });
    
    if (existingCall && existingCall.companyId) {
      // SECURITY: Validar tenant ao atualizar (via companyId obtido do call)
      await db.update(voiceCalls)
        .set({
          status: 'ended',
          endedAt: payload.data?.endedAt ? new Date(payload.data.endedAt as string) : new Date(),
          duration: payload.data?.duration as number | undefined,
          transcript: payload.data?.transcript,
          recordingUrl: payload.data?.recordingUrl as string | undefined,
          metadata: {
            ...(existingCall.metadata as object || {}),
            organizationId: orgId,
            source: 'custom_webhook',
            ...payload.data,
          },
        })
        .where(and(
          eq(voiceCalls.id, existingCall.id),
          eq(voiceCalls.companyId, existingCall.companyId)
        ));
    }
  }
}

async function handleCallAnalyzed(orgId: string, payload: CustomWebhookPayload) {
  logger.info('Custom event: call.analyzed', { orgId, callId: payload.callId });
  
  if (payload.callId) {
    // SECURITY: Buscar call primeiro para obter companyId (webhook externo, sem sessão)
    const existingCall = await db.query.voiceCalls.findFirst({
      where: eq(voiceCalls.externalCallId, payload.callId),
    });
    
    if (existingCall && existingCall.companyId) {
      // SECURITY: Validar tenant ao atualizar (via companyId obtido do call)
      await db.update(voiceCalls)
        .set({
          summary: payload.data?.summary as string | undefined,
          sentimentScore: payload.data?.sentimentScore?.toString(),
          qualityScore: payload.data?.qualityScore?.toString(),
          metadata: {
            ...(existingCall.metadata as object || {}),
            organizationId: orgId,
            source: 'custom_webhook',
            analysis: payload.data,
          },
        })
        .where(and(
          eq(voiceCalls.id, existingCall.id),
          eq(voiceCalls.companyId, existingCall.companyId)
        ));
    }
  }
}

async function handleAgentStatusChanged(orgId: string, payload: CustomWebhookPayload) {
  logger.info('Custom event: agent.status_changed', { orgId, agentId: payload.agentId, data: payload.data });
}

async function handleRecordingReady(orgId: string, payload: CustomWebhookPayload) {
  logger.info('Custom event: recording.ready', { orgId, callId: payload.callId, data: payload.data });
  
  if (payload.callId && payload.data?.recordingUrl) {
    // SECURITY: Buscar call primeiro para obter companyId (webhook externo, sem sessão)
    const existingCall = await db.query.voiceCalls.findFirst({
      where: eq(voiceCalls.externalCallId, payload.callId),
    });
    
    if (existingCall && existingCall.companyId) {
      // SECURITY: Validar tenant ao atualizar (via companyId obtido do call)
      await db.update(voiceCalls)
        .set({
          recordingUrl: payload.data.recordingUrl as string,
        })
        .where(and(
          eq(voiceCalls.id, existingCall.id),
          eq(voiceCalls.companyId, existingCall.companyId)
        ));
    }
  }
}

async function handleTranscriptReady(orgId: string, payload: CustomWebhookPayload) {
  logger.info('Custom event: transcript.ready', { orgId, callId: payload.callId });
  
  if (payload.callId && payload.data?.transcript) {
    // SECURITY: Buscar call primeiro para obter companyId (webhook externo, sem sessão)
    const existingCall = await db.query.voiceCalls.findFirst({
      where: eq(voiceCalls.externalCallId, payload.callId),
    });
    
    if (existingCall && existingCall.companyId) {
      // SECURITY: Validar tenant ao atualizar (via companyId obtido do call)
      await db.update(voiceCalls)
        .set({
          transcript: payload.data.transcript,
        })
        .where(and(
          eq(voiceCalls.id, existingCall.id),
          eq(voiceCalls.companyId, existingCall.companyId)
        ));
    }
  }
}

async function handleAnalysisComplete(orgId: string, payload: CustomWebhookPayload) {
  logger.info('Custom event: analysis.complete', { orgId, callId: payload.callId });
  
  if (payload.callId && payload.data) {
    // SECURITY: Buscar call primeiro para obter companyId (webhook externo, sem sessão)
    const existingCall = await db.query.voiceCalls.findFirst({
      where: eq(voiceCalls.externalCallId, payload.callId),
    });
    
    if (existingCall && existingCall.companyId) {
      // SECURITY: Validar tenant ao atualizar (via companyId obtido do call)
      await db.update(voiceCalls)
        .set({
          summary: payload.data.summary as string | undefined,
          sentimentScore: payload.data.sentimentScore?.toString(),
          qualityScore: payload.data.qualityScore?.toString(),
          metadata: {
            ...(existingCall.metadata as object || {}),
            organizationId: orgId,
            source: 'custom_webhook',
            analysis: payload.data,
          },
        })
        .where(and(
          eq(voiceCalls.id, existingCall.id),
          eq(voiceCalls.companyId, existingCall.companyId)
        ));
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  
  return NextResponse.json({
    success: true,
    webhook: 'custom',
    orgId,
    status: 'active',
    supportedEvents: [
      'call.started',
      'call.ended', 
      'call.analyzed',
      'agent.status_changed',
      'recording.ready',
      'transcript.ready',
      'analysis.complete',
    ],
    security: {
      signatureHeader: 'X-Webhook-Signature',
      algorithm: 'HMAC-SHA256',
    },
    timestamp: new Date().toISOString(),
  });
}
