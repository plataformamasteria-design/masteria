import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });
    
    logger.info('[Dial Callback] SIP Dial result received', { 
      callSid: body.CallSid,
      dialCallStatus: body.DialCallStatus,
      dialCallDuration: body.DialCallDuration,
      dialCallSid: body.DialCallSid,
      dialSipResponseCode: body.DialSipResponseCode,
      sipResponseCode: body.SipResponseCode,
      errorCode: body.ErrorCode,
      errorMessage: body.ErrorMessage,
    });

    // Log all body params for debugging
    logger.info('[Dial Callback] Full payload', { 
      body: JSON.stringify(body),
    });

    // Return empty TwiML - call will end naturally
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    logger.error('[Dial Callback] Error processing dial result', { error });
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
