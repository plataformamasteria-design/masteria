// src/lib/notifications/user-notifications.service.ts

import { db } from '@/lib/db';
import { userNotifications } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export type UserNotificationType = 'campaign_completed' | 'new_conversation' | 'new_appointment' | 'system_error' | 'info';

interface CreateNotificationParams {
  userId: string;
  companyId: string;
  type: UserNotificationType;
  title: string;
  message: string;
  linkTo?: string;
  metadata?: Record<string, any>;
}

export class UserNotificationsService {
  static async create(params: CreateNotificationParams): Promise<void> {
    try {
      await db.insert(userNotifications).values({
        userId: params.userId,
        companyId: params.companyId,
        type: params.type,
        title: params.title,
        message: params.message,
        linkTo: params.linkTo,
        metadata: params.metadata as any,
      });
    } catch (error) {
      // Log error but don't block - notifications are non-critical
      if (error instanceof Error) {
        console.error('[UserNotifications] Error creating notification:', {
          message: error.message,
          userId: params.userId,
          companyId: params.companyId,
          type: params.type,
        });
      }
    }
  }

  static async notifyCampaignCompleted(
    companyId: string,
    campaignId: string,
    campaignName: string,
    totalSent: number
  ): Promise<void> {
    const companyUsers = await db.query.users.findMany({
      where: (users, { eq }) => eq(users.companyId, companyId),
    });

    const notificationPromises = companyUsers.map(user =>
      this.create({
        userId: user.id,
        companyId,
        type: 'campaign_completed',
        title: 'Campanha Concluída',
        message: `Sua campanha "${campaignName}" foi enviada com sucesso para ${totalSent} contato(s).`,
        linkTo: `/campaigns/${campaignId}/report`,
        metadata: { campaignId, campaignName, totalSent },
      })
    );

    await Promise.allSettled(notificationPromises);
  }

  static async notifyNewConversation(
    companyId: string,
    conversationId: string,
    contactName: string
  ): Promise<void> {
    const companyUsers = await db.query.users.findMany({
      where: (users, { eq }) => eq(users.companyId, companyId),
    });

    const notificationPromises = companyUsers.map(user =>
      this.create({
        userId: user.id,
        companyId,
        type: 'new_conversation',
        title: 'Novo Atendimento',
        message: `Você tem um novo atendimento de ${contactName} aguardando.`,
        linkTo: `/atendimentos?conversationId=${conversationId}`,
        metadata: { conversationId, contactName },
      })
    );

    await Promise.allSettled(notificationPromises);
  }

  static async notifyLeadScheduled(
    companyId: string,
    leadId: string,
    contactName: string,
    boardId?: string
  ): Promise<void> {
    const companyUsers = await db.query.users.findMany({
      where: (users, { eq }) => eq(users.companyId, companyId),
    });

    const notificationPromises = companyUsers.map(user =>
      this.create({
        userId: user.id,
        companyId,
        type: 'new_appointment',
        title: 'Novo Agendamento',
        message: `Você tem um novo atendimento de ${contactName} aguardando.`,
        linkTo: boardId ? `/kanban/${boardId}` : '/kanban',
        metadata: { leadId, contactName, boardId },
      })
    );

    await Promise.allSettled(notificationPromises);
  }

  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    await db
      .update(userNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(userNotifications.id, notificationId),
          eq(userNotifications.userId, userId)
        )
      );
  }

  static async markAllAsRead(userId: string): Promise<void> {
    await db
      .update(userNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(userNotifications.userId, userId));
  }

  static async getUserNotifications(
    userId: string,
    limit: number = 20
  ): Promise<any[]> {
    return await db
      .select()
      .from(userNotifications)
      .where(eq(userNotifications.userId, userId))
      .orderBy(desc(userNotifications.createdAt))
      .limit(limit);
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const result = await db
      .select()
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.userId, userId),
          eq(userNotifications.isRead, false)
        )
      );
    
    return result.length;
  }

  static async notifyOpenAIQuotaExhausted(
    companyId: string,
    personaName?: string
  ): Promise<void> {
    const companyUsers = await db.query.users.findMany({
      where: (users, { eq }) => eq(users.companyId, companyId),
    });

    const notificationPromises = companyUsers.map(user =>
      this.create({
        userId: user.id,
        companyId,
        type: 'system_error',
        title: 'Quota OpenAI Esgotada',
        message: personaName
          ? `A quota da API OpenAI foi esgotada. A persona "${personaName}" está usando respostas de fallback. Verifique o billing em platform.openai.com.`
          : `A quota da API OpenAI foi esgotada. As respostas automáticas estão usando fallback. Verifique o billing em platform.openai.com.`,
        linkTo: '/settings?tab=ai',
        metadata: { personaName, errorType: 'insufficient_quota' },
      })
    );

    await Promise.allSettled(notificationPromises);
    console.log(`[UserNotifications] Notificação de quota OpenAI esgotada enviada para empresa ${companyId}`);
  }

  static async notifyGeminiQuotaExhausted(
    companyId: string,
    personaName?: string
  ): Promise<void> {
    const companyUsers = await db.query.users.findMany({
      where: (users, { eq }) => eq(users.companyId, companyId),
    });

    const notificationPromises = companyUsers.map(user =>
      this.create({
        userId: user.id,
        companyId,
        type: 'system_error',
        title: 'Quota Gemini Esgotada',
        message: personaName
          ? `A quota da API Gemini/Google foi esgotada. A persona "${personaName}" não está respondendo. Verifique o billing em console.cloud.google.com.`
          : `A quota da API Gemini/Google foi esgotada. As respostas automáticas não estão funcionando. Verifique o billing em console.cloud.google.com.`,
        linkTo: '/settings?tab=ai',
        metadata: { personaName, errorType: 'insufficient_quota', provider: 'GEMINI' },
      })
    );

    await Promise.allSettled(notificationPromises);
    console.log(`[UserNotifications] Notificação de quota Gemini esgotada enviada para empresa ${companyId}`);
  }
}
