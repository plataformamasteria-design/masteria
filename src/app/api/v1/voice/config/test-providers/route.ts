import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

async function testRetellProvider(): Promise<{ success: boolean; message: string; details?: unknown }> {
  const apiKey = process.env.RETELL_API_KEY;
  
  if (!apiKey) {
    return { success: false, message: 'RETELL_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.retellai.com/list-agents', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { 
        success: true, 
        message: 'Retell API connected successfully',
        details: { agentCount: Array.isArray(data) ? data.length : 0 },
      };
    } else {
      const errorText = await response.text();
      return { 
        success: false, 
        message: `Retell API error: ${response.status}`,
        details: errorText,
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function testTwilioProvider(): Promise<{ success: boolean; message: string; details?: unknown }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    return { success: false, message: 'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not configured' };
  }

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { 
        success: true, 
        message: 'Twilio API connected successfully',
        details: { friendlyName: data.friendly_name, status: data.status },
      };
    } else {
      const errorText = await response.text();
      return { 
        success: false, 
        message: `Twilio API error: ${response.status}`,
        details: errorText,
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function testLLMProvider(): Promise<{ success: boolean; message: string; details?: unknown }> {
  const geminiKey = process.env.GOOGLE_GEMINI_AGENTS1 || process.env.GOOGLE_GEMINI_AGENTS2 || process.env.GOOGLE_API_KEY;
  
  if (!geminiKey) {
    return { success: false, message: 'GOOGLE_GEMINI_AGENTS1/2 not configured' };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-exp:generateContent?key=${geminiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Test" }] }]
      })
    });

    if (response.ok) {
      return { 
        success: true, 
        message: 'Google Gemini API connected successfully',
      };
    } else {
      const errorText = await response.text();
      return { 
        success: false, 
        message: `Google Gemini API error: ${response.status}`,
        details: errorText,
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function POST(_request: NextRequest) {
  try {
    const [voiceResult, telephonyResult, llmResult] = await Promise.all([
      testRetellProvider(),
      testTwilioProvider(),
      testLLMProvider(),
    ]);

    logger.info('Voice providers tested', { 
      voice: voiceResult.success,
      telephony: telephonyResult.success,
      llm: llmResult.success 
    });

    return NextResponse.json({
      success: true,
      data: {
        voice: voiceResult,
        telephony: telephonyResult,
        llm: llmResult,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error testing voice providers', { error });
    return NextResponse.json(
      { error: 'Falha ao testar providers de voz', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
