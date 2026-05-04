import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { db } from '@/lib/db';
import { voiceCalls } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const twilioStatusSchema = z.object({
  CallSid: z.string(),
  CallStatus: z.enum(['queued', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled']),
  Called: z.string().optional(),
  Caller: z.string().optional(),
  From: z.string().optional(),
  To: z.string().optional(),
  Direction: z.enum(['inbound', 'outbound-api', 'outbound-dial']).optional(),
  CallDuration: z.string().optional(),
  RecordingUrl: z.string().optional(),
  RecordingSid: z.string().optional(),
  RecordingDuration: z.string().optional(),
  Timestamp: z.string().optional(),
  AccountSid: z.string().optional(),
  ApiVersion: z.string().optional(),
  SequenceNumber: z.string().optional(),
  CallbackSource: z.string().optional(),
  ParentCallSid: z.string().optional(),
  ErrorCode: z.string().optional(),
  ErrorMessage: z.string().optional(),
  SipResponseCode: z.string().optional(),
  DialCallSid: z.string().optional(),
  DialCallDuration: z.string().optional(),
  DialCallStatus: z.string().optional(),
  SipCallId: z.string().optional(),
});

type TwilioStatusPayload = z.infer<typeof twilioStatusSchema>;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });
    
    logger.info('Twilio status webhook received', { 
      callSid: body.CallSid,
      status: body.CallStatus,
      from: body.From,
      to: body.To,
      sipResponseCode: body.SipResponseCode,
      dialCallStatus: body.DialCallStatus,
      dialCallDuration: body.DialCallDuration,
      errorCode: body.ErrorCode,
      errorMessage: body.ErrorMessage,
    });

    const validation = twilioStatusSchema.safeParse(body);
    
    if (!validation.success) {
      logger.warn('Twilio status webhook validation failed', { 
        errors: validation.error.flatten(),
        body: JSON.stringify(body).slice(0, 500),
      });
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const payload: TwilioStatusPayload = validation.data;

    await handleTwilioStatus(payload);

    const processingTime = Date.now() - startTime;
    
    logger.info('Twilio status webhook processed', { 
      callSid: payload.CallSid,
      status: payload.CallStatus,
      processingTimeMs: processingTime,
    });

    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    logger.error('Twilio status webhook processing error', { error });
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

async function handleTwilioStatus(payload: TwilioStatusPayload) {
  const statusMap: Record<string, string> = {
    'queued': 'initiated',
    'ringing': 'initiated',
    'in-progress': 'ongoing',
    'completed': 'ended',
    'busy': 'failed',
    'failed': 'failed',
    'no-answer': 'failed',
    'canceled': 'failed',
  };

  const normalizedStatus = statusMap[payload.CallStatus] || 'unknown';
  const direction = payload.Direction?.includes('outbound') ? 'outbound' : 'inbound';

  logger.info('Processing Twilio status', {
    callSid: payload.CallSid,
    twilioStatus: payload.CallStatus,
    normalizedStatus,
    direction,
    duration: payload.CallDuration,
  });

  try {
    await db
      .update(voiceCalls)
      .set({
        status: normalizedStatus,
        duration: payload.CallDuration ? parseInt(payload.CallDuration, 10) : undefined,
        recordingUrl: payload.RecordingUrl,
        endedAt: normalizedStatus === 'ended' ? new Date() : undefined,
        metadata: {
          source: 'twilio_status_webhook',
          errorCode: payload.ErrorCode,
          errorMessage: payload.ErrorMessage,
        },
      })
      .where(eq(voiceCalls.externalCallId, payload.CallSid));
    
    logger.info('Twilio status - updated local DB', { 
      callSid: payload.CallSid, 
      status: normalizedStatus,
    });
  } catch (error) {
    logger.debug('No local call record to update for Twilio status', {
      callSid: payload.CallSid,
    });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    webhook: 'twilio-status',
    status: 'active',
    events: ['queued', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled'],
    timestamp: new Date().toISOString(),
  });
}
