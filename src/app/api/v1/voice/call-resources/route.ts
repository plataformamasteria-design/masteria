import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { retellService } from '@/lib/retell-service';
import { db } from '@/lib/db';
import { connections, smsGateways } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    let companyId: string;
    try {
      companyId = await getCompanyIdFromSession();
    } catch (sessionError) {
      logger.warn('No session found, returning empty resources', { error: sessionError });
      return NextResponse.json({
        phoneNumbers: [],
        retellAgents: [],
        whatsappConnections: [],
        smsGateways: [],
      });
    }

    // Fetch Retell agents first (needed to map to phone numbers)
    const agentsMap = new Map<string, { name: string; version: number }>();
    let retellAgents: {
      id: string;
      name: string;
      version: number;
      isPublished: boolean;
    }[] = [];

    if (retellService.isConfigured()) {
      try {
        const agents = await retellService.listAgents();
        retellAgents = agents
          .filter(a => a.is_published)
          .map(a => ({
            id: a.agent_id,
            name: a.agent_name,
            version: a.version,
            isPublished: a.is_published,
          }));

        // Create map for quick agent lookup
        agents.forEach(a => {
          agentsMap.set(a.agent_id, {
            name: a.agent_name,
            version: a.version,
          });
        });
      } catch (error) {
        logger.warn('Failed to fetch Retell agents', { error });
      }
    }

    // Fetch Retell phone numbers with agent bindings
    let phoneNumbers: {
      phoneNumber: string;
      friendlyName: string;
      nickname?: string;
      inboundAgentId?: string;
      inboundAgentName?: string;
      inboundAgentVersion?: number;
      outboundAgentId?: string;
      outboundAgentName?: string;
      outboundAgentVersion?: number;
    }[] = [];

    if (retellService.isConfigured()) {
      try {
        const retellNumbers = await retellService.listPhoneNumbers();
        phoneNumbers = retellNumbers.map(rn => {
          const inboundAgent = rn.inbound_agent_id
            ? agentsMap.get(rn.inbound_agent_id)
            : undefined;
          const outboundAgent = rn.outbound_agent_id
            ? agentsMap.get(rn.outbound_agent_id)
            : undefined;

          return {
            phoneNumber: rn.phone_number,
            friendlyName: rn.phone_number_pretty || rn.phone_number,
            nickname: rn.nickname,
            inboundAgentId: rn.inbound_agent_id,
            inboundAgentName: inboundAgent?.name,
            inboundAgentVersion: rn.inbound_agent_version || inboundAgent?.version,
            outboundAgentId: rn.outbound_agent_id,
            outboundAgentName: outboundAgent?.name,
            outboundAgentVersion: rn.outbound_agent_version || outboundAgent?.version,
          };
        });

        logger.info('Fetched Retell phone numbers', {
          count: phoneNumbers.length,
          numbers: phoneNumbers.map(n => n.phoneNumber),
        });
      } catch (error) {
        logger.warn('Failed to fetch Retell phone numbers', { error });
        // Fallback to empty list
        phoneNumbers = [];
      }
    }

    // Fetch WhatsApp connections with type
    const whatsappConnectionsData = await db
      .select({
        id: connections.id,
        name: connections.config_name,
        phoneNumber: connections.phone,
        connectionType: connections.connectionType,
        status: connections.status,
        isActive: connections.isActive,
      })
      .from(connections)
      .where(and(
        eq(connections.companyId, companyId),
        eq(connections.isActive, true)
      ));

    const whatsappConnections = whatsappConnectionsData.map(conn => ({
      id: conn.id,
      name: conn.name,
      phoneNumber: conn.phoneNumber,
      type: conn.connectionType === 'meta_api' ? 'meta_api' : 'baileys',
      status: conn.status,
      isActive: conn.isActive,
    }));

    logger.info('Fetched WhatsApp connections', {
      count: whatsappConnections.length,
      connections: whatsappConnections.map(c => ({ id: c.id, name: c.name, type: c.type })),
    });

    // Fetch SMS gateways
    const smsGatewaysList = await db
      .select({
        id: smsGateways.id,
        name: smsGateways.name,
        provider: smsGateways.provider,
      })
      .from(smsGateways)
      .where(and(
        eq(smsGateways.companyId, companyId),
        eq(smsGateways.isActive, true)
      ));

    return NextResponse.json({
      phoneNumbers,
      retellAgents,
      whatsappConnections,
      smsGateways: smsGatewaysList,
    });
  } catch (error) {
    logger.error('Error fetching call resources', { error });
    return NextResponse.json(
      { error: 'Erro ao buscar recursos de comunicação' },
      { status: 500 }
    );
  }
}
