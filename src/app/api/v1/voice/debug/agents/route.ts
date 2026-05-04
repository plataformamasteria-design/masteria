import { NextRequest, NextResponse } from 'next/server';
import { retellService } from '@/lib/retell-service';
import { logger } from '@/lib/logger';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { voiceAgents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    // 1. [SECURITY] Authenticate and get Company ID
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info(`DEBUG: Listing Retell agents for company ${companyId}`);

    // 2. Fetch Company's Agents from DB
    const dbAgents = await db.select({
      agentId: voiceAgents.externalId
    }).from(voiceAgents).where(eq(voiceAgents.companyId, companyId));

    const allowedAgentIds = dbAgents.map(a => a.agentId).filter(id => id !== null) as string[];

    if (allowedAgentIds.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        agents: [],
        timestamp: new Date().toISOString(),
      });
    }

    // 3. Fetch all from Retell (Global)
    const allRetellAgents = await retellService.listAgents();

    // 4. [SECURITY] Filter Memory-side to ensure isolation
    const companyAgents = allRetellAgents.filter(a => allowedAgentIds.includes(a.agent_id));

    logger.info('DEBUG: Successfully retrieved Retell agents', {
      total_retell: allRetellAgents.length,
      company_filtered: companyAgents.length
    });

    return NextResponse.json({
      success: true,
      count: companyAgents.length,
      agents: companyAgents,
      // [SECURITY] Do NOT expose API Key prefix even in debug
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('DEBUG: Error listing Retell agents', { error: errorMessage });

    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
