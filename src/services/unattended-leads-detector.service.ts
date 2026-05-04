'use server';

import { db } from '@/lib/db';
import { conversations, messages, contacts, connections } from '@/lib/db/schema';
import { and, eq, sql, desc } from 'drizzle-orm';
import { processIncomingMessageTrigger } from '@/lib/automation-engine';

interface UnattendedLead {
  conversationId: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  connectionId: string;
  connectionName: string;
  companyId: string;
  lastUserMessageAt: Date;
  lastUserMessageContent: string;
  lastAIMessageAt: Date | null;
  minutesSinceLastUserMessage: number;
}

interface DetectionResult {
  unattendedLeads: UnattendedLead[];
  processedCount: number;
  errors: string[];
}

const UNATTENDED_THRESHOLD_MINUTES = 5;
const MAX_RECOVERY_AGE_HOURS = 24;

export async function detectUnattendedLeads(companyId?: string): Promise<UnattendedLead[]> {
  const now = new Date();
  const thresholdTimeStr = new Date(now.getTime() - (UNATTENDED_THRESHOLD_MINUTES * 60 * 1000)).toISOString();
  const maxAgeTimeStr = new Date(now.getTime() - (MAX_RECOVERY_AGE_HOURS * 60 * 60 * 1000)).toISOString();

  const companyFilter = companyId ? sql`cv.company_id = ${companyId}` : sql`TRUE`;

  const results = await db.execute(sql`
    SELECT 
      cv.id as conversation_id,
      cv.contact_id,
      cv.connection_id,
      cv.company_id,
      ct.name as contact_name,
      ct.phone as contact_phone,
      cn.config_name as connection_name,
      (
        SELECT m1.sent_at FROM messages m1 
        WHERE m1.conversation_id = cv.id AND m1.sender_type = 'USER' 
        ORDER BY m1.sent_at DESC LIMIT 1
      ) as last_user_msg_at,
      (
        SELECT m1.content FROM messages m1 
        WHERE m1.conversation_id = cv.id AND m1.sender_type = 'USER' 
        ORDER BY m1.sent_at DESC LIMIT 1
      ) as last_user_msg_content,
      (
        SELECT m2.sent_at FROM messages m2 
        WHERE m2.conversation_id = cv.id AND m2.sender_type = 'AI' 
        ORDER BY m2.sent_at DESC LIMIT 1
      ) as last_ai_msg_at
    FROM conversations cv
    JOIN contacts ct ON cv.contact_id = ct.id
    JOIN connections cn ON cv.connection_id = cn.id
    WHERE ${companyFilter}
      AND cv.archived_at IS NULL
      AND cv.status != 'closed'
      AND cv.last_message_at >= ${maxAgeTimeStr}::timestamp
      AND cv.connection_id IS NOT NULL
    ORDER BY cv.last_message_at DESC
    LIMIT 50
  `);

  const unattendedLeads: UnattendedLead[] = [];
  const rows = results as unknown as any[];

  for (const row of rows) {
    const lastUserMsgAt = row.last_user_msg_at ? new Date(row.last_user_msg_at) : null;
    const lastAIMsgAt = row.last_ai_msg_at ? new Date(row.last_ai_msg_at) : null;

    if (!lastUserMsgAt) continue;

    if (lastAIMsgAt && lastAIMsgAt > lastUserMsgAt) continue;

    if (lastUserMsgAt > new Date(thresholdTimeStr)) continue;

    const minutesSince = Math.round((now.getTime() - lastUserMsgAt.getTime()) / (60 * 1000));

    unattendedLeads.push({
      conversationId: row.conversation_id,
      contactId: row.contact_id,
      contactName: row.contact_name || 'Desconhecido',
      contactPhone: row.contact_phone || '',
      connectionId: row.connection_id,
      connectionName: row.connection_name || 'Conexão',
      companyId: row.company_id,
      lastUserMessageAt: lastUserMsgAt,
      lastUserMessageContent: row.last_user_msg_content || '',
      lastAIMessageAt: lastAIMsgAt,
      minutesSinceLastUserMessage: minutesSince,
    });
  }

  unattendedLeads.sort((a, b) => b.minutesSinceLastUserMessage - a.minutesSinceLastUserMessage);

  return unattendedLeads;
}

export async function recoverUnattendedLead(lead: UnattendedLead): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[UnattendedLeads] Attempting recovery for ${lead.contactName} (${lead.contactPhone})`);

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, lead.conversationId))
      .limit(1);

    if (!conversation) {
      return { success: false, error: 'Conversa não encontrada' };
    }

    const [connection] = await db
      .select()
      .from(connections)
      .where(eq(connections.id, lead.connectionId))
      .limit(1);

    if (!connection) {
      return { success: false, error: 'Conexão não encontrada' };
    }

    if (connection.status !== 'connected') {
      return { success: false, error: `Conexão não está ativa (status: ${connection.status})` };
    }

    const [lastUserMessage] = await db
      .select()
      .from(messages)
      .where(and(
        eq(messages.conversationId, lead.conversationId),
        eq(messages.senderType, 'USER')
      ))
      .orderBy(desc(messages.sentAt))
      .limit(1);

    if (!lastUserMessage) {
      return { success: false, error: 'Mensagem do usuário não encontrada' };
    }

    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, lead.contactId))
      .limit(1);

    if (!contact) {
      return { success: false, error: 'Contato não encontrado' };
    }

    console.log(`[UnattendedLeads] Reprocessing message for ${lead.contactName}: "${lastUserMessage.content?.substring(0, 50)}..."`);

    await processIncomingMessageTrigger(
      lead.conversationId,
      lastUserMessage.id,
      false
    );

    console.log(`[UnattendedLeads] ✅ Recovery completed for ${lead.contactName}`);
    return { success: true };

  } catch (error: any) {
    console.error(`[UnattendedLeads] ❌ Recovery failed for ${lead.contactName}:`, error.message);
    return { success: false, error: error.message };
  }
}

export async function runRecoveryBatch(companyId?: string, maxLeads: number = 10): Promise<DetectionResult> {
  console.log(`[UnattendedLeads] Starting batch recovery (maxLeads: ${maxLeads})`);
  
  const unattendedLeads = await detectUnattendedLeads(companyId);
  const toProcess = unattendedLeads.slice(0, maxLeads);
  
  console.log(`[UnattendedLeads] Found ${unattendedLeads.length} unattended leads, processing ${toProcess.length}`);

  const errors: string[] = [];
  let processedCount = 0;

  for (const lead of toProcess) {
    const result = await recoverUnattendedLead(lead);
    if (result.success) {
      processedCount++;
    } else if (result.error) {
      errors.push(`${lead.contactName}: ${result.error}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`[UnattendedLeads] Batch complete: ${processedCount}/${toProcess.length} processed successfully`);

  return {
    unattendedLeads,
    processedCount,
    errors,
  };
}

export async function getUnattendedLeadsSummary(companyId: string): Promise<{
  total: number;
  critical: number;
  warning: number;
  leads: UnattendedLead[];
}> {
  const leads = await detectUnattendedLeads(companyId);
  
  return {
    total: leads.length,
    critical: leads.filter(l => l.minutesSinceLastUserMessage > 60).length,
    warning: leads.filter(l => l.minutesSinceLastUserMessage > 15 && l.minutesSinceLastUserMessage <= 60).length,
    leads,
  };
}
