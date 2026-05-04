'use server';

import { db } from '@/lib/db';
import { connections, conversations } from '@/lib/db/schema';
import { and, eq, sql, isNull, gte, ne } from 'drizzle-orm';

interface SessionHealth {
  connectionId: string;
  connectionName: string;
  companyId: string;
  status: string;
  lastConnected: Date | null;
  isActive: boolean;
  healthScore: number;
  issues: string[];
}

interface AlertSummary {
  disconnectedSessions: SessionHealth[];
  unhealthySessions: SessionHealth[];
  unattendedLeadsCount: number;
  criticalAlerts: string[];
}

export async function checkSessionHealth(connectionId: string): Promise<SessionHealth> {
  const [connection] = await db
    .select()
    .from(connections)
    .where(eq(connections.id, connectionId))
    .limit(1);

  if (!connection) {
    return {
      connectionId,
      connectionName: 'Unknown',
      companyId: '',
      status: 'not_found',
      lastConnected: null,
      isActive: false,
      healthScore: 0,
      issues: ['Connection not found'],
    };
  }

  const issues: string[] = [];
  let healthScore = 100;

  if (connection.status !== 'connected') {
    issues.push(`Status is ${connection.status}`);
    healthScore -= 50;
  }

  if (!connection.isActive) {
    issues.push('Connection is not active');
    healthScore -= 30;
  }

  const lastConnectedTime = connection.lastConnected;
  if (lastConnectedTime) {
    const hoursSinceLastConnect = (Date.now() - new Date(lastConnectedTime).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastConnect > 24) {
      issues.push(`Last connected ${Math.round(hoursSinceLastConnect)} hours ago`);
      healthScore -= 20;
    }
  } else {
    issues.push('Never connected successfully');
    healthScore -= 40;
  }

  return {
    connectionId: connection.id,
    connectionName: connection.config_name,
    companyId: connection.companyId,
    status: connection.status || 'unknown',
    lastConnected: lastConnectedTime,
    isActive: connection.isActive || false,
    healthScore: Math.max(0, healthScore),
    issues,
  };
}

export async function getAlertSummary(companyId?: string): Promise<AlertSummary> {
  const companyFilter = companyId ? eq(connections.companyId, companyId) : sql`TRUE`;

  const allConnections = await db
    .select()
    .from(connections)
    .where(and(
      companyFilter,
      eq(connections.connectionType, 'baileys')
    ));

  const sessionHealthChecks = await Promise.all(
    allConnections.map(conn => checkSessionHealth(conn.id))
  );

  const disconnectedSessions = sessionHealthChecks.filter(s => s.status !== 'connected');
  const unhealthySessions = sessionHealthChecks.filter(s => s.healthScore < 70 && s.status === 'connected');

  const now = new Date();
  const thresholdTime = new Date(now.getTime() - (5 * 60 * 1000));

  const unattendedConversations = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(conversations)
    .where(and(
      companyFilter ? eq(conversations.companyId, companyId!) : sql`TRUE`,
      isNull(conversations.archivedAt),
      ne(conversations.status, 'closed'),
      gte(conversations.lastMessageAt, thresholdTime)
    ));

  const unattendedLeadsCount = Number(unattendedConversations[0]?.count || 0);

  const criticalAlerts: string[] = [];

  if (disconnectedSessions.length > 0) {
    criticalAlerts.push(`${disconnectedSessions.length} WhatsApp connection(s) disconnected`);
  }

  if (unattendedLeadsCount > 5) {
    criticalAlerts.push(`${unattendedLeadsCount} leads waiting for response`);
  }

  return {
    disconnectedSessions,
    unhealthySessions,
    unattendedLeadsCount,
    criticalAlerts,
  };
}

export async function logSessionDisconnection(connectionId: string, reason: string): Promise<void> {
  console.log(`[SessionAlerts] ⚠️ Connection ${connectionId} disconnected: ${reason}`);
  
  const health = await checkSessionHealth(connectionId);
  
  if (health.healthScore < 50) {
    console.error(`[SessionAlerts] 🚨 CRITICAL: Connection ${health.connectionName} is in critical state`);
  }
}

export async function emitAlert(type: 'session_disconnect' | 'unattended_lead' | 'ai_failure', details: Record<string, any>): Promise<void> {
  const timestamp = new Date().toISOString();
  
  console.log(`[Alert|${type}|${timestamp}]`, JSON.stringify(details));
}
