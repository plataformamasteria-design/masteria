import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { mapDisconnectionReasonToOutcome } from '@/lib/voice-utils';
import { updateVoiceDeliveryWithOutcome } from '@/lib/campaign-sender';
import { db } from '@/lib/db';
import { voiceCalls } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const retellWebhookSchema = z.object({
  event: z.enum(['call_started', 'call_ended', 'call_analyzed', 'agent_response', 'user_transcript']),
  call: z.object({
    call_id: z.string(),
    call_type: z.string().optional(),
    agent_id: z.string().optional(),
    agent_name: z.string().optional(),
    from_number: z.string().optional(),
    to_number: z.string().optional(),
    direction: z.enum(['inbound', 'outbound']).optional(),
    start_timestamp: z.number().optional(),
    end_timestamp: z.number().optional(),
    duration_ms: z.number().optional(),
    call_status: z.string().optional(),
    disconnection_reason: z.string().optional(),
    transcript: z.string().optional(),
    transcript_object: z.array(z.object({
      role: z.string().optional(),
      content: z.string().optional(),
      timestamp: z.number().optional(),
    })).optional(),
    recording_url: z.string().optional(),
    custom_sip_headers: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
  }),
  call_analysis: z.object({
    call_summary: z.string().optional(),
    user_sentiment: z.string().optional(),
    call_successful: z.boolean().optional(),
    custom_analysis_data: z.record(z.any()).optional(),
  }).optional(),
});

type RetellWebhookPayload = z.infer<typeof retellWebhookSchema>;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    
    logger.info('Retell webhook received', { 
      event: body.event,
      callId: body.call?.call_id,
      agentId: body.call?.agent_id,
    });

    const validation = retellWebhookSchema.safeParse(body);
    
    if (!validation.success) {
      logger.warn('Retell webhook validation failed', { 
        errors: validation.error.flatten(),
        body: JSON.stringify(body).slice(0, 500),
      });
      return NextResponse.json(
        { success: false, error: 'Invalid webhook payload', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const payload: RetellWebhookPayload = validation.data;

    switch (payload.event) {
      case 'call_started':
        await handleCallStarted(payload);
        break;
      case 'call_ended':
        await handleCallEnded(payload);
        break;
      case 'call_analyzed':
        await handleCallAnalyzed(payload);
        break;
      case 'agent_response':
      case 'user_transcript':
        logger.debug('Retell streaming event received', { event: payload.event, callId: payload.call.call_id });
        break;
      default:
        logger.warn('Unknown Retell event', { event: payload.event });
    }

    const processingTime = Date.now() - startTime;
    
    logger.info('Retell webhook processed', { 
      event: payload.event,
      callId: payload.call.call_id,
      processingTimeMs: processingTime,
    });

    return NextResponse.json({
      success: true,
      event: payload.event,
      callId: payload.call.call_id,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Retell webhook processing error', { error });
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleCallStarted(payload: RetellWebhookPayload) {
  const callData = payload.call;
  logger.info('Processing call_started event', {
    callId: callData.call_id,
    agentId: callData.agent_id,
    fromNumber: callData.from_number,
    toNumber: callData.to_number,
    direction: callData.direction,
  });

  // Update local database if call exists (for inbound calls logged during webhook)
  try {
    await db
      .update(voiceCalls)
      .set({
        status: 'ongoing',
        startedAt: callData.start_timestamp ? new Date(callData.start_timestamp) : new Date(),
      })
      .where(eq(voiceCalls.retellCallId, callData.call_id));
    
    logger.info('Call started - updated local DB', { callId: callData.call_id });
  } catch (error) {
    logger.debug('No local call record to update for call_started (may be outbound campaign)', {
      callId: callData.call_id,
    });
  }
}

async function handleCallEnded(payload: RetellWebhookPayload) {
  const callData = payload.call;
  const disconnectionReason = callData.disconnection_reason || null;
  const durationSeconds = callData.duration_ms ? Math.round(callData.duration_ms / 1000) : null;
  
  logger.info('Processing call_ended event', {
    callId: callData.call_id,
    durationMs: callData.duration_ms,
    disconnectionReason,
    recordingUrl: callData.recording_url,
  });

  const callOutcome = mapDisconnectionReasonToOutcome(disconnectionReason);
  
  logger.info('Call outcome determined', {
    callId: callData.call_id,
    disconnectionReason,
    callOutcome,
  });

  // Update voice delivery reports (for campaigns)
  try {
    await updateVoiceDeliveryWithOutcome(
      callData.call_id,
      callOutcome,
      disconnectionReason,
      durationSeconds
    );
  } catch (error) {
    logger.error('Failed to update voice delivery with outcome', {
      callId: callData.call_id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Update local voice_calls table (for inbound/direct calls)
  try {
    await db
      .update(voiceCalls)
      .set({
        status: 'ended',
        endedAt: callData.end_timestamp ? new Date(callData.end_timestamp) : new Date(),
        duration: durationSeconds,
        recordingUrl: callData.recording_url,
        transcript: callData.transcript,
        disconnectReason: disconnectionReason,
        metadata: {
          callOutcome,
          transcript_object: callData.transcript_object,
        },
      })
      .where(eq(voiceCalls.retellCallId, callData.call_id));
    
    logger.info('Call ended - updated local DB', { 
      callId: callData.call_id, 
      durationSeconds,
      callOutcome,
    });
  } catch (error) {
    logger.debug('No local call record to update for call_ended', {
      callId: callData.call_id,
    });
  }
}

async function handleCallAnalyzed(payload: RetellWebhookPayload) {
  const callData = payload.call;
  logger.info('Processing call_analyzed event', {
    callId: callData.call_id,
    hasSummary: !!payload.call_analysis?.call_summary,
    sentiment: payload.call_analysis?.user_sentiment,
    successful: payload.call_analysis?.call_successful,
  });

  // Update local voice_calls table with analysis data
  if (payload.call_analysis) {
    try {
      const sentimentMap: Record<string, number> = {
        'positive': 1,
        'neutral': 0,
        'negative': -1,
      };
      const sentimentScore = payload.call_analysis.user_sentiment 
        ? sentimentMap[payload.call_analysis.user_sentiment] ?? 0 
        : undefined;

      await db
        .update(voiceCalls)
        .set({
          summary: payload.call_analysis.call_summary,
          metadata: {
            successful: payload.call_analysis.call_successful,
            customData: payload.call_analysis.custom_analysis_data,
            sentimentScore: sentimentScore,
            source: 'retell_webhook',
          },
        })
        .where(eq(voiceCalls.retellCallId, callData.call_id));
      
      logger.info('Call analyzed - updated local DB with analysis', { 
        callId: callData.call_id,
        sentiment: payload.call_analysis.user_sentiment,
        successful: payload.call_analysis.call_successful,
      });
    } catch (error) {
      logger.debug('No local call record to update for call_analyzed', {
        callId: callData.call_id,
      });
    }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get('challenge');
  
  if (challenge) {
    logger.info('Retell webhook verification', { challenge });
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({
    success: true,
    webhook: 'retell',
    status: 'active',
    events: ['call_started', 'call_ended', 'call_analyzed', 'agent_response', 'user_transcript'],
    timestamp: new Date().toISOString(),
  });
}
