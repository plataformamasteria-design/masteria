import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    const sipCode = parseInt(body.SipResponseCode || body.DialSipResponseCode || '0', 10);
    const callSid = body.CallSid;

    logger.info('[SIP Status] Received SIP status callback', {
      callSid,
      sipCallId: body.SipCallId,
      sipResponseCode: sipCode,
      callStatus: body.CallStatus,
      dialCallStatus: body.DialCallStatus,
    });

    // Diagnostic warnings for common WhatsApp/SIP integration issues
    if (sipCode === 401 || sipCode === 407) {
      logger.warn('[SIP Status] Authentication Challenge. This is normal during setup, but if persistent, check Username/Password in Meta and Twilio.', { callSid });
    } else if (sipCode === 403) {
      logger.error('[SIP Status] 403 Forbidden. Check IP Access Control Lists or Credential Lists in Twilio.', { callSid });
    } else if (sipCode === 488) {
      logger.error('[SIP Status] 488 Not Acceptable Here. Codec mismatch. Ensure Opus/G.711 is supported.', { callSid });
    } else if (sipCode >= 500) {
      logger.error('[SIP Status] Server Error (5xx). Check Twilio or Meta status.', { callSid, code: sipCode });
    }

    // Log full payload only on errors or warnings for debugging
    if (sipCode >= 400) {
      logger.info('[SIP Status] Full failure payload', { body: JSON.stringify(body) });
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    logger.error('[SIP Status] Error processing SIP status', { error });
    return new NextResponse('Error', { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'SIP Status endpoint is ready' 
  });
}
