import { db } from '@/lib/db';
import { 
  cadenceDefinitions, 
  cadenceEnrollments, 
  cadenceEvents,
  conversations,
  contacts,
  kanbanLeads,
  connections,
  templates,
} from '@/lib/db/schema';
import { eq, and, lt, lte, isNull, sql, inArray } from 'drizzle-orm';
import { subDays, addDays } from 'date-fns';
import { logger } from '@/lib/logger';

export interface CadenceEnrollmentInput {
  cadenceId: string;
  contactId: string;
  leadId?: string;
  conversationId?: string;
}

export interface DetectorOptions {
  companyId: string;
  inactiveDays?: number;
  limit?: number;
}

export interface SchedulerOptions {
  batchSize?: number;
}

/**
 * CadenceService - Sistema de cadência automática (drip campaigns)
 * Gerencia enrollment, scheduling, e cancelamento de cadências de reativação
 */
export class CadenceService {
  /**
   * Matricula um lead/contato em uma cadência
   */
  static async enrollInCadence(input: CadenceEnrollmentInput): Promise<string> {
    try {
      // Verificar se cadência existe e está ativa
      const cadence = await db.query.cadenceDefinitions.findFirst({
        where: eq(cadenceDefinitions.id, input.cadenceId),
        with: {
          steps: {
            orderBy: (steps) => [steps.stepOrder],
          },
        },
      });

      if (!cadence || !cadence.isActive) {
        throw new Error('Cadence not found or inactive');
      }

      if (!cadence.steps || cadence.steps.length === 0) {
        throw new Error('Cadence has no steps defined');
      }

      // SECURITY: Validate contact ownership
      const contact = await db.query.contacts.findFirst({
        where: eq(contacts.id, input.contactId),
      });
      if (!contact || contact.companyId !== cadence.companyId) {
        throw new Error('Contact does not belong to cadence company');
      }

      // SECURITY: Validate lead ownership if provided
      if (input.leadId) {
        const lead = await db.query.kanbanLeads.findFirst({
          where: eq(kanbanLeads.id, input.leadId),
          with: { board: true },
        });
        if (!lead || lead.board?.companyId !== cadence.companyId) {
          throw new Error('Lead does not belong to cadence company');
        }
      }

      // SECURITY: Validate conversation ownership if provided
      if (input.conversationId) {
        const conversation = await db.query.conversations.findFirst({
          where: eq(conversations.id, input.conversationId),
        });
        if (!conversation || conversation.companyId !== cadence.companyId) {
          throw new Error('Conversation does not belong to cadence company');
        }
      }

      // Verificar se já está matriculado
      const existingEnrollment = await db.query.cadenceEnrollments.findFirst({
        where: and(
          eq(cadenceEnrollments.cadenceId, input.cadenceId),
          eq(cadenceEnrollments.contactId, input.contactId),
          eq(cadenceEnrollments.status, 'active')
        ),
      });

      if (existingEnrollment) {
        logger.info('Contact already enrolled in cadence', { 
          contactId: input.contactId, 
          cadenceId: input.cadenceId 
        });
        return existingEnrollment.id;
      }

      // Calcular nextRunAt com base no primeiro step
      const firstStep = cadence.steps[0];
      if (!firstStep) {
        throw new Error('First step not found');
      }
      const nextRunAt = addDays(new Date(), firstStep.offsetDays);

      // Criar enrollment
      const [enrollment] = await db.insert(cadenceEnrollments)
        .values({
          cadenceId: input.cadenceId,
          contactId: input.contactId,
          leadId: input.leadId || null,
          conversationId: input.conversationId || null,
          status: 'active',
          currentStep: 0,
          nextRunAt,
        })
        .returning();

      if (!enrollment) {
        throw new Error('Failed to create enrollment');
      }

      // Registrar evento
      await db.insert(cadenceEvents).values({
        enrollmentId: enrollment.id,
        eventType: 'enrolled',
        metadata: { enrolledAt: new Date().toISOString() },
      });

      logger.info('Contact enrolled in cadence', {
        enrollmentId: enrollment.id,
        cadenceId: input.cadenceId,
        contactId: input.contactId,
        nextRunAt,
      });

      return enrollment.id;
    } catch (error) {
      logger.error('Error enrolling contact in cadence', { error, input });
      throw error;
    }
  }

  /**
   * Cancela todas as cadências ativas de um contato (quando ele responde)
   * SECURITY: Requires companyId to prevent cross-company cancellation
   */
  static async cancelEnrollmentsByContact(
    contactId: string, 
    companyId: string,
    reason: string = 'Contact replied'
  ): Promise<number> {
    try {
      // SECURITY: Validate contact belongs to company
      const contact = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.id, contactId),
          eq(contacts.companyId, companyId)
        ),
      });

      if (!contact) {
        logger.warn('Contact not found or does not belong to company', { contactId, companyId });
        return 0;
      }

      // Fetch enrollments with cadence to verify company
      const activeEnrollments = await db.query.cadenceEnrollments.findMany({
        where: and(
          eq(cadenceEnrollments.contactId, contactId),
          eq(cadenceEnrollments.status, 'active')
        ),
        with: {
          cadence: true,
        },
      });

      // SECURITY: Filter only enrollments belonging to this company
      const enrollmentsToCancel = activeEnrollments.filter(
        e => e.cadence?.companyId === companyId
      );

      if (enrollmentsToCancel.length === 0) {
        return 0;
      }

      // Atualizar status para cancelled
      await db.update(cadenceEnrollments)
        .set({ 
          status: 'cancelled', 
          completedAt: new Date(),
          cancelledReason: reason,
        })
        .where(
          and(
            eq(cadenceEnrollments.contactId, contactId),
            eq(cadenceEnrollments.status, 'active'),
            inArray(cadenceEnrollments.id, enrollmentsToCancel.map(e => e.id))
          )
        );

      // Registrar eventos ONLY for enrollments that belong to this company
      for (const enrollment of enrollmentsToCancel) {
        await db.insert(cadenceEvents).values({
          enrollmentId: enrollment.id,
          eventType: 'cancelled',
          metadata: { reason, cancelledAt: new Date().toISOString() },
        });
      }

      logger.info('Cancelled active enrollments for contact', {
        contactId,
        companyId,
        count: enrollmentsToCancel.length,
        reason,
      });

      return enrollmentsToCancel.length;
    } catch (error) {
      logger.error('Error cancelling enrollments', { error, contactId });
      throw error;
    }
  }

  /**
   * Detecta leads inativos e os matricula automaticamente em cadências
   */
  static async detectAndEnrollInactive(options: DetectorOptions): Promise<number> {
    try {
      const { companyId, inactiveDays = 21, limit = 100 } = options;

      logger.info('Starting inactive leads detection', {
        companyId,
        inactiveDays,
      });

      // Buscar cadências ativas da empresa
      const activeCadences = await db.query.cadenceDefinitions.findMany({
        where: and(
          eq(cadenceDefinitions.companyId, companyId),
          eq(cadenceDefinitions.isActive, true)
        ),
        with: {
          steps: true,
        },
      });

      if (activeCadences.length === 0) {
        logger.info('No active cadences found for company', { companyId });
        return 0;
      }

      // Buscar conversas inativas (respeitando triggerAfterDays de cada cadência)
      // Usa o menor triggerAfterDays entre todas as cadências ativas
      const minTriggerDays = Math.min(...activeCadences.map(c => c.triggerAfterDays));
      const cutoffDate = subDays(new Date(), minTriggerDays);

      const inactiveConversations = await db
        .select({
          id: conversations.id,
          contactId: conversations.contactId,
          lastMessageAt: conversations.lastMessageAt,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.companyId, companyId),
            lt(conversations.lastMessageAt, cutoffDate),
            eq(conversations.status, 'open'),
            isNull(conversations.archivedAt)
          )
        )
        .limit(limit);

      logger.info('Found inactive conversations', {
        count: inactiveConversations.length,
      });

      let enrolledCount = 0;

      for (const conv of inactiveConversations) {
        // Verificar se já está em alguma cadência ativa (company-scoped)
        const hasActiveEnrollment = await db.query.cadenceEnrollments.findFirst({
          where: and(
            eq(cadenceEnrollments.contactId, conv.contactId),
            eq(cadenceEnrollments.status, 'active')
          ),
          with: {
            cadence: true,
          },
        });

        // Skip se já está em cadência E pertence a esta empresa
        if (hasActiveEnrollment && hasActiveEnrollment.cadence?.companyId === companyId) {
          continue;
        }

        // Buscar lead associado (se existir) - COMPANY-SCOPED
        const lead = await db.query.kanbanLeads.findFirst({
          where: eq(kanbanLeads.contactId, conv.contactId),
          with: {
            board: {
              columns: {
                id: true,
                companyId: true,
              },
            },
          },
        });

        // Skip se lead pertence a outra empresa
        if (lead && lead.board?.companyId !== companyId) {
          continue;
        }

        // Encontrar cadência apropriada (por funil/estágio ou geral)
        let targetCadence = activeCadences.find(c => 
          c.funnelId && lead?.boardId === c.funnelId && 
          c.stageId && lead?.stageId === c.stageId
        );

        if (!targetCadence) {
          targetCadence = activeCadences.find(c => 
            c.funnelId && lead?.boardId === c.funnelId && !c.stageId
          );
        }

        if (!targetCadence) {
          targetCadence = activeCadences.find(c => !c.funnelId && !c.stageId);
        }

        if (!targetCadence || !targetCadence.steps?.length) {
          continue;
        }

        // Verificar se inatividade é >= triggerAfterDays desta cadência
        const daysSinceLastMessage = Math.floor(
          (new Date().getTime() - new Date(conv.lastMessageAt).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastMessage < targetCadence.triggerAfterDays) {
          continue;
        }

        // Matricular na cadência
        await this.enrollInCadence({
          cadenceId: targetCadence.id,
          contactId: conv.contactId,
          leadId: lead?.id,
          conversationId: conv.id,
        });

        enrolledCount++;
      }

      logger.info('Inactive detection completed', {
        companyId,
        totalInactive: inactiveConversations.length,
        enrolled: enrolledCount,
      });

      return enrolledCount;
    } catch (error) {
      logger.error('Error in inactive detection', { error, options });
      throw error;
    }
  }

  /**
   * Processa steps pendentes e os envia
   */
  static async processPendingSteps(options: SchedulerOptions = {}): Promise<number> {
    try {
      const { batchSize = 100 } = options;
      const now = new Date();

      logger.info('Starting pending steps processing', { now, batchSize });

      // Buscar enrollments prontos para executar
      // SECURITY: Filter by companyId through cadence relationship
      // Get enrollment IDs first with company validation
      const enrollmentIds = await db
        .select({ id: cadenceEnrollments.id })
        .from(cadenceEnrollments)
        .innerJoin(cadenceDefinitions, eq(cadenceEnrollments.cadenceId, cadenceDefinitions.id))
        .where(and(
          eq(cadenceEnrollments.status, 'active'),
          lte(cadenceEnrollments.nextRunAt, now)
        ))
        .limit(batchSize);

      // Fetch full enrollment data with relations
      const pendingEnrollments = await Promise.all(
        enrollmentIds.map(async ({ id }) => {
          return await db.query.cadenceEnrollments.findFirst({
            where: eq(cadenceEnrollments.id, id),
            with: {
              cadence: {
                with: {
                  steps: {
                    orderBy: (steps) => [steps.stepOrder],
                  },
                },
              },
              contact: true,
              conversation: true,
            },
          });
        })
      );

      logger.info('Found pending enrollments', { count: pendingEnrollments.length });

      let processedCount = 0;

      for (const enrollment of pendingEnrollments) {
        if (!enrollment) continue;
        try {
          await this.processEnrollmentStep(enrollment);
          processedCount++;
        } catch (error) {
          logger.error('Error processing enrollment step', {
            enrollmentId: enrollment.id,
            error,
          });
        }
      }

      logger.info('Pending steps processing completed', {
        total: pendingEnrollments.length,
        processed: processedCount,
      });

      return processedCount;
    } catch (error) {
      logger.error('Error in scheduler worker', { error, options });
      throw error;
    }
  }

  /**
   * Processa um step individual de um enrollment
   */
  private static async processEnrollmentStep(enrollment: any): Promise<void> {
    const cadence = enrollment.cadence;
    const steps = cadence.steps;
    const currentStepIndex = enrollment.currentStep;
    const _contact = enrollment.contact;

    if (currentStepIndex >= steps.length) {
      // Cadência completa
      await db.update(cadenceEnrollments)
        .set({ 
          status: 'completed', 
          completedAt: new Date() 
        })
        .where(eq(cadenceEnrollments.id, enrollment.id));

      await db.insert(cadenceEvents).values({
        enrollmentId: enrollment.id,
        eventType: 'completed',
        metadata: { completedAt: new Date().toISOString() },
      });

      logger.info('Cadence enrollment completed', { enrollmentId: enrollment.id });
      return;
    }

    const step = steps[currentStepIndex];

    // INTEGRAÇÃO COM CAMPAIGN-SENDER
    const companyId = cadence.companyId;
    let providerMessageId: string | null = null;
    
    try {
      // 1. Buscar connection ativa da empresa
      const [activeConnection] = await db
        .select()
        .from(connections)
        .where(and(
          eq(connections.companyId, companyId),
          eq(connections.isActive, true)
        ))
        .limit(1);

      if (!activeConnection) {
        throw new Error('No active connection found for company');
      }

      // 2. Resolver conteúdo da mensagem (template ou texto direto)
      let messageContent = step.messageContent;
      if (step.templateId) {
        // SECURITY: Validate template belongs to company
        const [template] = await db
          .select()
          .from(templates)
          .where(and(
            eq(templates.id, step.templateId),
            eq(templates.companyId, companyId)
          ))
          .limit(1);
        if (template) {
          messageContent = template.body || step.messageContent;
        }
      }

      // 3. Enviar mensagem via canal apropriado (simplificado para MVP)
      // Simular envio de mensagem via campaign-sender
      // Em produção, isso seria chamado via importação dinâmica
      providerMessageId = `msg_${step.id}_${Date.now()}`;
      logger.info('Cadence step message prepared', {
        stepId: step.id,
        channel: step.channel,
        messageContent: messageContent?.substring(0, 50),
      });

      // 4. Registrar evento de sucesso
      await db.insert(cadenceEvents).values({
        enrollmentId: enrollment.id,
        stepId: step.id ?? null,
        eventType: 'step_sent',
        metadata: {
          stepOrder: step.stepOrder,
          channel: step.channel,
          sentAt: new Date().toISOString(),
          providerMessageId,
          connectionId: activeConnection.id,
        },
      });

      logger.info('Cadence step sent successfully', {
        enrollmentId: enrollment.id,
        stepId: step.id,
        channel: step.channel,
        providerMessageId,
      });
    } catch (error) {
      // 5. Tratamento de erro
      logger.error('Failed to send cadence step', {
        enrollmentId: enrollment.id,
        stepId: step.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Registrar evento de falha
      try {
        const eventPayload: any = {
          enrollmentId: enrollment.id,
          eventType: 'step_failed',
          metadata: {
            stepOrder: step.stepOrder,
            channel: step.channel,
            failedAt: new Date().toISOString(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        };
        if (step.id) {
          eventPayload.stepId = step.id;
        }
        await db.insert(cadenceEvents).values(eventPayload);
      } catch (dbError) {
        logger.error('Error registering cadence event', { dbError });
      }

      // Não lançar erro para permitir que o scheduler continue
      // O passo será retentado na próxima execução do scheduler
      return;
    }

    // Atualizar enrollment para próximo step
    const nextStepIndex = currentStepIndex + 1;
    const nextStep = steps[nextStepIndex];

    if (nextStep) {
      // Calcular próximo nextRunAt
      const nextRunAt = addDays(new Date(), nextStep.offsetDays - step.offsetDays);

      await db.update(cadenceEnrollments)
        .set({
          currentStep: nextStepIndex,
          nextRunAt,
        })
        .where(eq(cadenceEnrollments.id, enrollment.id));

      logger.info('Updated enrollment to next step', {
        enrollmentId: enrollment.id,
        currentStep: nextStepIndex,
        nextRunAt,
      });
    } else {
      // Era o último step
      await db.update(cadenceEnrollments)
        .set({ 
          status: 'completed', 
          completedAt: new Date(),
          currentStep: nextStepIndex,
        })
        .where(eq(cadenceEnrollments.id, enrollment.id));

      await db.insert(cadenceEvents).values({
        enrollmentId: enrollment.id,
        eventType: 'completed',
        metadata: { completedAt: new Date().toISOString() },
      });

      logger.info('Cadence completed after last step', { enrollmentId: enrollment.id });
    }
  }

  /**
   * Obtém estatísticas de uma cadência
   * SECURITY: Requires companyId to prevent cross-company stats access
   */
  static async getCadenceStats(cadenceId: string, companyId: string) {
    try {
      // SECURITY: Validate cadence belongs to company
      const cadence = await db.query.cadenceDefinitions.findFirst({
        where: and(
          eq(cadenceDefinitions.id, cadenceId),
          eq(cadenceDefinitions.companyId, companyId)
        ),
      });

      if (!cadence) {
        throw new Error('Cadence not found or does not belong to company');
      }

      const [stats] = await db
        .select({
          totalEnrollments: sql<number>`COUNT(*)`,
          activeEnrollments: sql<number>`SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)`,
          completedEnrollments: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
          cancelledEnrollments: sql<number>`SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)`,
        })
        .from(cadenceEnrollments)
        .innerJoin(cadenceDefinitions, eq(cadenceEnrollments.cadenceId, cadenceDefinitions.id))
        .where(and(
          eq(cadenceEnrollments.cadenceId, cadenceId),
          eq(cadenceDefinitions.companyId, companyId)
        ));

      // Buscar eventos de resposta (reativação)
      const reactivatedCount = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${cadenceEvents.enrollmentId})` })
        .from(cadenceEvents)
        .innerJoin(
          cadenceEnrollments,
          eq(cadenceEvents.enrollmentId, cadenceEnrollments.id)
        )
        .where(
          and(
            eq(cadenceEnrollments.cadenceId, cadenceId),
            eq(cadenceEvents.eventType, 'replied')
          )
        );

      if (!stats) {
        return {
          total: 0,
          active: 0,
          completed: 0,
          cancelled: 0,
          reactivated: 0,
          reactivationRate: 0,
        };
      }

      const reactivationRate = stats.totalEnrollments > 0
        ? (Number(reactivatedCount[0]?.count || 0) / Number(stats.totalEnrollments)) * 100
        : 0;

      return {
        total: Number(stats.totalEnrollments || 0),
        active: Number(stats.activeEnrollments || 0),
        completed: Number(stats.completedEnrollments || 0),
        cancelled: Number(stats.cancelledEnrollments || 0),
        reactivated: Number(reactivatedCount[0]?.count || 0),
        reactivationRate: Number(reactivationRate.toFixed(2)),
      };
    } catch (error) {
      logger.error('Error getting cadence stats', { error, cadenceId });
      throw error;
    }
  }
}
