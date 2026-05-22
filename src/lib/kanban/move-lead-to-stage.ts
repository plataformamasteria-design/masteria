import { db } from '@/lib/db';
import { kanbanLeads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { KanbanStage } from '@/lib/types';
import { NotificationService } from '@/lib/notifications/notification-service';
import { UserNotificationsService } from '../notifications/user-notifications.service';
import { webhookDispatcher } from '@/services/webhook-dispatcher.service';
import { logContactEvent } from '@/lib/contact-events';

export interface MoveLeadToStageParams {
  leadId: string;
  newStageId: string;
  companyId: string;
}

export interface MoveLeadToStageResult {
  success: boolean;
  error?: string;
  lead?: typeof kanbanLeads.$inferSelect;
}

export async function moveLeadToStage(
  params: MoveLeadToStageParams
): Promise<MoveLeadToStageResult> {
  const { leadId, newStageId, companyId } = params;

  try {
    const lead = await db.query.kanbanLeads.findFirst({
      where: eq(kanbanLeads.id, leadId),
      with: {
        contact: true,
        board: true,
      },
    });

    if (!lead) {
      return { success: false, error: 'Lead não encontrado' };
    }

    if (lead.board.companyId !== companyId) {
      return { success: false, error: 'Acesso negado' };
    }

    if (lead.stageId === newStageId) {
      return { success: true, lead };
    }

    const stages = lead.board.stages as KanbanStage[];
    const previousStage = stages.find(s => s.id === lead.stageId);
    const newStage = stages.find(s => s.id === newStageId);

    if (!newStage) {
      return { success: false, error: 'Estágio não encontrado' };
    }

    const isMovingToWin = newStage.type === 'WIN';

    await db.update(kanbanLeads)
      .set({
        stageId: newStageId,
        currentStage: newStage,
        lastStageChangeAt: new Date(),
      })
      .where(eq(kanbanLeads.id, leadId));

    // 🌟 APLICAR AUTOMAÇÃO DE ENTRADA NA ETAPA
    if (newStage.entryAutomationId) {
      import('@/lib/flow-engine').then(({ triggerFlow }) => {
        triggerFlow(newStage.entryAutomationId!, companyId, lead.contactId, {
          trigger_type: 'kanban_stage_entered',
          board_id: lead.boardId,
          stage_id: newStageId,
        }).catch(err => console.warn('[Stage Entry Automation] failed:', err));
      }).catch(err => console.warn('[Stage Entry Automation] import failed:', err));
    }

    try {
      await logContactEvent(
        companyId,
        lead.contactId,
        'KANBAN',
        `Lead movido para etapa: ${newStage.title}`,
        { 
          fromStage: previousStage?.title || lead.stageId, 
          toStage: newStage.title, 
          boardName: lead.board.title || 'Funil' 
        }
      );
    } catch (e) {
      console.warn('[logContactEvent] Failed to log kanban move:', e);
    }

    // 🆕 SOCKET.IO: Emit real-time update
    try {
      const { getSocketIO } = await import('@/lib/socket');
      const io = getSocketIO();
      if (io) {
        io.to(`company:${companyId}`).emit('lead_moved', {
          leadId: lead.id,
          boardId: lead.boardId,
          fromStageId: lead.stageId,
          toStageId: newStageId,
          source: 'internal'
        });
      }
    } catch (socketError) {
      console.warn('[Socket.IO] Failed to emit lead_moved event:', socketError);
    }

    try {
      console.log(`[Webhook] Dispatching lead_stage_changed for lead ${leadId}`);
      await webhookDispatcher.dispatch(companyId, 'lead_stage_changed', {
        leadId: lead.id,
        previousStage: previousStage?.title || 'Unknown',
        newStage: newStage.title,
        contactName: lead.contact.name,
      });
    } catch (webhookError) {
      console.error('[Webhook] Error dispatching lead_stage_changed:', webhookError);
    }

    // 🆕 KOMMO SYNC: Update lead stage in Kommo CRM (fire-and-forget)
    if (lead.externalId && lead.externalProvider === 'kommo') {
      import('@/services/kommo-lead-sync.service').then(({ updateLeadStageInKommo }) => {
        updateLeadStageInKommo(companyId, lead.externalId!, newStageId, lead.boardId)
          .catch(err => console.warn('[Kommo] Stage sync failed (non-blocking):', err));
      }).catch(err => console.warn('[Kommo] Stage sync import failed:', err));
    }

    if (isMovingToWin) {
      NotificationService.safeNotify(
        NotificationService.notifyNewSale.bind(NotificationService),
        'MoveLeadToStage',
        companyId,
        {
          name: lead.contact.name,
          value: lead.value ? Number(lead.value) : undefined,
        }
      );

      try {
        console.log(`[Webhook] Dispatching sale_closed for lead ${leadId}`);
        await webhookDispatcher.dispatch(companyId, 'sale_closed', {
          leadId: lead.id,
          contactName: lead.contact.name,
          value: lead.value ? Number(lead.value) : undefined,
          closedAt: new Date().toISOString(),
        });
      } catch (webhookError) {
        console.error('[Webhook] Error dispatching sale_closed:', webhookError);
      }
    }

    const isMovingToMeetingScheduled = newStage.semanticType === 'meeting_scheduled';

    if (isMovingToMeetingScheduled) {
      try {
        console.log(`[UserNotification] Dispatching new_appointment for lead ${leadId}`);
        await UserNotificationsService.notifyLeadScheduled(
          companyId,
          lead.id,
          lead.contact.name,
          lead.board.id
        );

        console.log(`[Webhook] Dispatching meeting_scheduled for lead ${leadId}`);
        await webhookDispatcher.dispatch(companyId, 'meeting_scheduled', {
          leadId: lead.id,
          contactName: lead.contact.name,
          stageName: newStage.title,
          scheduledAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[MoveLeadToStage] Error notifying lead scheduled:', error);
      }
    }

    const updatedLead = await db.query.kanbanLeads.findFirst({
      where: eq(kanbanLeads.id, leadId),
      with: {
        contact: true,
        board: true,
      },
    });

    return { success: true, lead: updatedLead };
  } catch (error) {
    console.error('[MoveLeadToStage] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
