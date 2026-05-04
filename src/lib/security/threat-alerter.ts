// src/lib/security/threat-alerter.ts
// Sistema de alertas e logging de ameaças de segurança

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type { ThreatType, ThreatLevel, ThreatMatch } from './input-sanitizer';

export interface SecurityLogEntry {
    companyId: string;
    conversationId?: string;
    contactId?: string;
    contactPhone?: string;
    threatType: ThreatType;
    threatLevel: ThreatLevel;
    content?: string;
    threats: ThreatMatch[];
    actionTaken: 'BLOCKED' | 'WARNED' | 'LOGGED';
}

// ============================================
// LOGGING DE AMEAÇAS NO BANCO
// ============================================

export async function logSecurityThreat(entry: SecurityLogEntry): Promise<void> {
    try {
        // Truncar conteúdo para evitar armazenar payloads maliciosos grandes
        const truncatedContent = entry.content
            ? entry.content.substring(0, 500) + (entry.content.length > 500 ? '...' : '')
            : null;

        await db.execute(sql`
      INSERT INTO security_logs (
        company_id, 
        conversation_id, 
        contact_id, 
        threat_type, 
        threat_level, 
        content, 
        action_taken,
        metadata
      ) VALUES (
        ${entry.companyId},
        ${entry.conversationId || null},
        ${entry.contactId || null},
        ${entry.threatType},
        ${entry.threatLevel},
        ${truncatedContent},
        ${entry.actionTaken},
        ${JSON.stringify({
            threats: entry.threats.map(t => ({
                type: t.type,
                pattern: t.pattern,
                severity: t.severity,
            })),
            contactPhone: entry.contactPhone,
            timestamp: new Date().toISOString(),
        })}
      )
    `);

        console.log(`[Security] 🚨 Threat logged: ${entry.threatType} (${entry.threatLevel}) - ${entry.actionTaken}`);
    } catch (error) {
        // Não falhar a operação principal se o log falhar
        console.error('[Security] Failed to log threat:', error);
    }
}

// ============================================
// SISTEMA DE ALERTAS
// ============================================

export async function sendSecurityAlert(entry: SecurityLogEntry): Promise<void> {
    // Enviar alerta apenas para ameaças críticas
    if (entry.threatLevel !== 'BLOCKED') return;

    try {
        // Importar dinamicamente para evitar dependência circular
        const { UserNotificationsService } = await import('@/lib/notifications/user-notifications.service');

        // Buscar admins da empresa
        const admins = await db.execute(sql`
      SELECT id, email, name FROM users 
      WHERE company_id = ${entry.companyId} 
      AND role IN ('admin', 'owner')
      LIMIT 5
    `);

        const adminList = admins.rows as Array<{ id: string; email: string; name: string }>;

        for (const admin of adminList) {
            await UserNotificationsService.createNotification({
                userId: admin.id,
                type: 'SECURITY_ALERT',
                title: '🚨 Tentativa de Ataque Detectada',
                message: `Tipo: ${entry.threatType}\nNível: ${entry.threatLevel}\n${entry.contactPhone ? `Contato: ${entry.contactPhone}` : ''}`,
                priority: 'HIGH',
                metadata: {
                    conversationId: entry.conversationId,
                    threatType: entry.threatType,
                },
            });
        }

        console.log(`[Security] Alert sent to ${adminList.length} admin(s)`);
    } catch (error) {
        console.error('[Security] Failed to send alert:', error);
    }
}

// ============================================
// FUNÇÃO COMBINADA
// ============================================

export async function handleSecurityThreat(entry: SecurityLogEntry): Promise<void> {
    // 1. Sempre logar
    await logSecurityThreat(entry);

    // 2. Alertar se for crítico
    if (entry.threatLevel === 'BLOCKED') {
        await sendSecurityAlert(entry);
    }
}

// ============================================
// MÉTRICAS DE SEGURANÇA
// ============================================

export async function getSecurityMetrics(companyId: string, days: number = 7): Promise<{
    totalThreats: number;
    blocked: number;
    byType: Record<string, number>;
}> {
    try {
        const result = await db.execute(sql`
      SELECT 
        threat_type,
        threat_level,
        COUNT(*) as count
      FROM security_logs
      WHERE company_id = ${companyId}
        AND created_at > NOW() - INTERVAL '${sql.raw(String(days))} days'
      GROUP BY threat_type, threat_level
    `);

        const rows = result.rows as Array<{ threat_type: string; threat_level: string; count: string }>;

        let totalThreats = 0;
        let blocked = 0;
        const byType: Record<string, number> = {};

        for (const row of rows) {
            const count = parseInt(row.count);
            totalThreats += count;

            if (row.threat_level === 'BLOCKED') {
                blocked += count;
            }

            byType[row.threat_type] = (byType[row.threat_type] || 0) + count;
        }

        return { totalThreats, blocked, byType };
    } catch (error) {
        console.error('[Security] Failed to get metrics:', error);
        return { totalThreats: 0, blocked: 0, byType: {} };
    }
}
