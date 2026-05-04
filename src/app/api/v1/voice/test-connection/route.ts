import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { voiceAgents, voiceCalls } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

async function testRetellConnection(): Promise<{ success: boolean; message: string; details?: unknown }> {
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
        message: 'Connected',
        details: { agentCount: Array.isArray(data) ? data.length : 0 },
      };
    } else {
      return { success: false, message: `API error: ${response.status}` };
    }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function testTwilioConnection(): Promise<{ success: boolean; message: string; details?: unknown }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    return { success: false, message: 'TWILIO credentials not configured' };
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
        message: 'Connected',
        details: { friendlyName: data.friendly_name, status: data.status },
      };
    } else {
      return { success: false, message: `API error: ${response.status}` };
    }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function GET(_request: NextRequest) {
  try {
    // SECURITY: Validar tenant para teste de conexão (mesmo sendo diagnóstico de infraestrutura)
    const companyId = await getCompanyIdFromSession().catch(() => null);
    
    const results: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    try {
      const retellResult = await testRetellConnection();
      if (retellResult.success) {
        results.retell = retellResult;
      } else {
        errors.retell = retellResult.message;
      }
    } catch (error) {
      errors.retell = error instanceof Error ? error.message : 'Unknown error';
    }

    try {
      const twilioResult = await testTwilioConnection();
      if (twilioResult.success) {
        results.twilio = twilioResult;
      } else {
        errors.twilio = twilioResult.message;
      }
    } catch (error) {
      errors.twilio = error instanceof Error ? error.message : 'Unknown error';
    }

    try {
      // SECURITY: Validar tenant ao contar agentes e chamadas (para teste de conexão)
      const agentsResult = companyId 
        ? await db.select({ count: sql<number>`count(*)` }).from(voiceAgents).where(eq(voiceAgents.companyId, companyId))
        : await db.select({ count: sql<number>`count(*)` }).from(voiceAgents);
      const callsResult = companyId
        ? await db.select({ count: sql<number>`count(*)` }).from(voiceCalls).where(eq(voiceCalls.companyId, companyId))
        : await db.select({ count: sql<number>`count(*)` }).from(voiceCalls);
      results.database = { 
        connected: true,
        agentsCount: Number(agentsResult[0]?.count ?? 0),
        callsCount: Number(callsResult[0]?.count ?? 0),
      };
    } catch (error) {
      errors.database = error instanceof Error ? error.message : 'Unknown error';
    }

    const hasErrors = Object.keys(errors).length > 0;
    const allFailed = Object.keys(errors).length >= 3;

    logger.info('Voice connection test completed', { results, errors });

    return NextResponse.json({
      success: !allFailed,
      configured: true,
      timestamp: new Date().toISOString(),
      providers: {
        retell: {
          configured: !!process.env.RETELL_API_KEY,
          connected: !errors.retell,
          details: results.retell,
        },
        twilio: {
          configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
          connected: !errors.twilio,
          details: results.twilio,
        },
      },
      database: results.database,
      results,
      errors: hasErrors ? errors : undefined,
    });

  } catch (error) {
    logger.error('Voice connection test error:', { error });
    return NextResponse.json({
      success: false,
      error: 'Failed to test connection',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
