import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { voiceAgents } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { getCompanyIdFromSession } from '@/app/actions';
import { eq } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    
    const retellApiKey = process.env.RETELL_API_KEY;
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

    const agents = await db.query.voiceAgents.findMany({
      where: eq(voiceAgents.companyId, companyId),
    });

    const retellAgents = agents.filter(a => a.retellAgentId);

    const configStatus = {
      retell: {
        configured: !!retellApiKey,
        agentCount: retellAgents.length,
      },
      twilio: {
        configured: !!(twilioAccountSid && twilioAuthToken),
      },
    };

    logger.info('External resources fetched', { 
      retellAgents: retellAgents.length,
      retellConfigured: configStatus.retell.configured,
      twilioConfigured: configStatus.twilio.configured,
    });

    return NextResponse.json({
      success: true,
      data: {
        organizations: [],
        retellAgents: retellAgents.map(a => ({
          id: a.id,
          name: a.name,
          retellAgentId: a.retellAgentId,
          voiceId: a.voiceId,
          status: a.status,
        })),
        twilioPhoneNumbers: [],
        configStatus,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching external resources', { error });
    return NextResponse.json(
      { error: 'Falha ao buscar recursos externos', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
