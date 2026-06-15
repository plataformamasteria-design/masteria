// src/lib/ai-followup-scheduler.ts
'use server';

import { db } from '@/lib/db';
import {
    aiFollowupQueue,
    aiPersonas,
    conversations,
    messages,
    contacts,
    connections
} from '@/lib/db/schema';
import { eq, and, lte, gte, sql } from 'drizzle-orm';
import { addMinutes, addDays } from 'date-fns';
import { logger } from '@/lib/logger';
import { sendUnifiedMessage } from '@/services/unified-message-sender.service';

/**
 * Schedule a follow-up message for a conversation
 * Called after AI sends a response
 */
export async function scheduleFollowUp(
    conversationId: string,
    personaId: string,
    companyId: string
): Promise<string | null> {
    try {
        // Fetch persona with follow-up config
        const [persona] = await db.select()
            .from(aiPersonas)
            .where(and(
                eq(aiPersonas.id, personaId),
                eq(aiPersonas.companyId, companyId)
            ))
            .limit(1);

        if (!persona || !persona.followupEnabled) {
            return null;
        }

        // Check if there's already a pending follow-up for this conversation
        const [existingFollowup] = await db.select()
            .from(aiFollowupQueue)
            .where(and(
                eq(aiFollowupQueue.conversationId, conversationId),
                eq(aiFollowupQueue.status, 'pending')
            ))
            .limit(1);

        if (existingFollowup) {
            // Cancel existing and create new one (reset timer on new AI response)
            await db.update(aiFollowupQueue)
                .set({
                    status: 'cancelled',
                    cancelledAt: new Date()
                })
                .where(eq(aiFollowupQueue.id, existingFollowup.id));
        }

        // Calculate scheduled time based on mode
        // Modo diário: agendar para daqui 24h (1 dia)
        // Modo minutos: usar o delay em minutos configurado
        const scheduledAt = persona.followupMode === 'daily'
            ? addDays(new Date(), 1)
            : addMinutes(new Date(), persona.followupDelayMinutes);

        // Create new follow-up entry
        const [followup] = await db.insert(aiFollowupQueue)
            .values({
                conversationId,
                personaId,
                companyId,
                scheduledAt,
                attemptNumber: 1,
                status: 'pending'
            })
            .returning();

        logger.info('Follow-up scheduled', {
            followupId: followup?.id,
            conversationId,
            scheduledAt,
            delayMinutes: persona.followupDelayMinutes
        });

        return followup?.id || null;
    } catch (error) {
        logger.error('Error scheduling follow-up', { error, conversationId, personaId });
        return null;
    }
}

/**
 * Cancel all pending follow-ups for a conversation (when contact replies)
 */
export async function cancelFollowUps(
    conversationId: string,
    companyId: string,
    reason: string = 'Contact replied'
): Promise<number> {
    try {
        const result = await db.update(aiFollowupQueue)
            .set({
                status: 'cancelled',
                cancelledAt: new Date()
            })
            .where(and(
                eq(aiFollowupQueue.conversationId, conversationId),
                eq(aiFollowupQueue.companyId, companyId),
                eq(aiFollowupQueue.status, 'pending')
            ))
            .returning({ id: aiFollowupQueue.id });

        if (result.length > 0) {
            logger.info('Follow-ups cancelled', {
                conversationId,
                count: result.length,
                reason
            });
        }

        return result.length;
    } catch (error) {
        logger.error('Error cancelling follow-ups', { error, conversationId });
        return 0;
    }
}

/**
 * Process pending follow-up queue
 * Should be called by a cron job or scheduler
 */
export async function processFollowUpQueue(batchSize: number = 50): Promise<number> {
    try {
        const now = new Date();

        // Fetch pending follow-ups that are due
        const pendingFollowups = await db.select({
            followup: aiFollowupQueue,
            persona: aiPersonas,
            conversation: conversations,
        })
            .from(aiFollowupQueue)
            .innerJoin(aiPersonas, eq(aiFollowupQueue.personaId, aiPersonas.id))
            .innerJoin(conversations, eq(aiFollowupQueue.conversationId, conversations.id))
            .where(and(
                eq(aiFollowupQueue.status, 'pending'),
                lte(aiFollowupQueue.scheduledAt, now)
            ))
            .limit(batchSize);

        logger.info('Processing follow-up queue', {
            pendingCount: pendingFollowups.length,
            now
        });

        let processedCount = 0;

        for (const { followup, persona, conversation } of pendingFollowups) {
            try {
                // Check if contact has replied since scheduling
                // ✅ FIX: Aceitar tanto 'USER' (Baileys) quanto 'CONTACT' (Meta API)
                const recentContactMessage = await db.select()
                    .from(messages)
                    .where(and(
                        eq(messages.conversationId, followup.conversationId),
                        sql`${messages.senderType} IN ('USER', 'CONTACT')`,
                        gte(messages.sentAt, followup.createdAt)
                    ))
                    .limit(1);

                if (recentContactMessage.length > 0) {
                    // Contact replied - cancel follow-up
                    await db.update(aiFollowupQueue)
                        .set({
                            status: 'cancelled',
                            cancelledAt: new Date()
                        })
                        .where(eq(aiFollowupQueue.id, followup.id));
                    continue;
                }

                // Get contact info
                const [contact] = await db.select()
                    .from(contacts)
                    .where(eq(contacts.id, conversation.contactId))
                    .limit(1);

                if (!contact) continue;

                // Get active connection
                const [connection] = await db.select()
                    .from(connections)
                    .where(and(
                        eq(connections.companyId, followup.companyId),
                        eq(connections.isActive, true)
                    ))
                    .limit(1);

                if (!connection) {
                    logger.warn('No active connection for follow-up, marking as failed to prevent loop', { followupId: followup.id });
                    await db.update(aiFollowupQueue)
                        .set({
                            status: 'failed',
                            cancelledAt: new Date()
                        })
                        .where(eq(aiFollowupQueue.id, followup.id));
                    continue;
                }

                // Get follow-up message based on attempt number
                const followupMessages = (persona.followupMessages as string[]) || [];
                const messageIndex = Math.min(followup.attemptNumber - 1, followupMessages.length - 1);
                const messageText = followupMessages[messageIndex] || 'Oi! Posso ajudar em algo mais?';

                // Send follow-up message
                const result = await sendUnifiedMessage({
                    provider: connection.connectionType === 'meta_api' ? 'apicloud' : 'baileys',
                    connectionId: connection.id,
                    to: contact.phone,
                    message: messageText,
                });

                if (result.success) {
                    // Mark as sent
                    await db.update(aiFollowupQueue)
                        .set({
                            status: 'sent',
                            sentAt: new Date()
                        })
                        .where(eq(aiFollowupQueue.id, followup.id));

                    // Save message to conversation
                    await db.insert(messages).values({
                        companyId: followup.companyId,
                        conversationId: followup.conversationId,
                        senderType: 'AI',
                        content: messageText,
                        contentType: 'TEXT',
                        status: 'SENT',
                        isAiGenerated: true,
                    });

                    // Schedule next follow-up if not at max attempts
                    // ✅ FIX: Modo diário usa followupDaysCount como limite de tentativas
                    const maxAttempts = persona.followupMode === 'daily'
                        ? Math.min(persona.followupDaysCount, persona.followupMaxAttempts)
                        : persona.followupMaxAttempts;

                    if (followup.attemptNumber < maxAttempts) {
                        // ✅ FIX: Modo diário agenda para próximo dia, modo minutos usa delay configurado
                        const nextScheduledAt = persona.followupMode === 'daily'
                            ? addDays(new Date(), 1)
                            : addMinutes(new Date(), persona.followupDelayMinutes);
                        await db.insert(aiFollowupQueue).values({
                            conversationId: followup.conversationId,
                            personaId: followup.personaId,
                            companyId: followup.companyId,
                            scheduledAt: nextScheduledAt,
                            attemptNumber: followup.attemptNumber + 1,
                            status: 'pending'
                        });
                    }

                    processedCount++;
                    logger.info('Follow-up sent', {
                        followupId: followup.id,
                        attemptNumber: followup.attemptNumber,
                        contactPhone: contact.phone
                    });
                } else {
                    logger.error('Failed to send follow-up', {
                        followupId: followup.id,
                        error: result.error
                    });
                }
            } catch (itemError) {
                logger.error('Error processing follow-up item', {
                    followupId: followup.id,
                    error: itemError
                });
            }
        }

        logger.info('Follow-up queue processing complete', {
            processed: processedCount,
            total: pendingFollowups.length
        });

        return processedCount;
    } catch (error) {
        logger.error('Error processing follow-up queue', { error });
        return 0;
    }
}
