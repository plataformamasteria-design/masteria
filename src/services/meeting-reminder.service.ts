/**
 * Meeting Reminder Service
 * Sends WhatsApp reminders before scheduled meetings
 * Polls every 60 seconds for upcoming meetings that need reminders
 */

import { db } from '@/lib/db';
import { aiScheduledMeetings, aiPersonas, connections, messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendUnifiedMessage } from '@/services/unified-message-sender.service';

class MeetingReminderService {
    private intervalId: NodeJS.Timeout | null = null;
    private isProcessing = false;
    private readonly POLL_INTERVAL_MS = 60 * 1000; // 60 seconds

    start() {
        if (this.intervalId) {
            console.log('[MeetingReminder] ⚠️ Service already running');
            return;
        }

        console.log('[MeetingReminder] 🔔 Starting meeting reminder service (polling every 60s)');

        // Initial run after 30s delay (let other services start first)
        setTimeout(() => {
            this.checkAndSendReminders();
            this.intervalId = setInterval(() => {
                this.checkAndSendReminders();
            }, this.POLL_INTERVAL_MS);
        }, 30000);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[MeetingReminder] ⏹️ Service stopped');
        }
    }

    private async checkAndSendReminders() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const now = new Date();
            const maxWindowMs = 65 * 60 * 1000;
            const windowEnd = new Date(now.getTime() + maxWindowMs);

            let upcomingMeetings: any[];
            try {
                // Use raw SQL to avoid Drizzle ORM null-object crash on JOINs
                const { conn } = await import('@/lib/db');
                upcomingMeetings = await conn`
                    SELECT 
                        m.id as meeting_id, m.company_id, m.conversation_id, m.contact_id,
                        m.title, m.description, m.scheduled_at, m.duration_minutes,
                        m.meet_link, m.status, m.reminder_sent,
                        c.id as conv_id, c.connection_id, c.persona_id,
                        ct.id as contact_id_ref, ct.phone as contact_phone, ct.name as contact_name
                    FROM ai_scheduled_meetings m
                    INNER JOIN conversations c ON m.conversation_id = c.id
                    INNER JOIN contacts ct ON m.contact_id = ct.id
                    WHERE m.status = 'scheduled'
                      AND m.reminder_sent = false
                      AND m.scheduled_at >= ${now}
                      AND m.scheduled_at <= ${windowEnd}
                    LIMIT 50
                ` as any[];
            } catch (queryErr: any) {
                // Table may not exist yet — silently skip
                if (!queryErr.message?.includes('does not exist')) {
                    console.warn('[MeetingReminder] ⚠️ Query failed:', queryErr.message);
                }
                return;
            }

            if (!upcomingMeetings || upcomingMeetings.length === 0) return;

            for (const row of upcomingMeetings) {
                try {
                    if (!row || !row.conv_id || !row.contact_phone) continue;

                    const meeting = {
                        id: row.meeting_id,
                        companyId: row.company_id,
                        conversationId: row.conversation_id,
                        contactId: row.contact_id,
                        title: row.title,
                        description: row.description,
                        scheduledAt: row.scheduled_at,
                        durationMinutes: row.duration_minutes,
                        meetLink: row.meet_link,
                        status: row.status,
                        reminderSent: row.reminder_sent,
                    };
                    const conversation = {
                        id: row.conv_id,
                        connectionId: row.connection_id,
                        personaId: row.persona_id,
                    };
                    const contact = {
                        id: row.contact_id_ref,
                        phone: row.contact_phone,
                        name: row.contact_name,
                    };

                    await this.processReminder(meeting as any, conversation, contact);
                } catch (err: any) {
                    console.error(`[MeetingReminder] ❌ Error processing reminder for meeting ${row?.meeting_id}:`, err.message);
                }
            }
        } catch (err: any) {
            console.error('[MeetingReminder] ❌ Error in reminder check cycle:', err.message);
        } finally {
            this.isProcessing = false;
        }
    }

    private async processReminder(
        meeting: typeof aiScheduledMeetings.$inferSelect,
        conversation: { id: string; connectionId: string | null; personaId: string | null },
        contact: { id: string; phone: string; name: string | null }
    ) {
        if (!conversation.personaId || !conversation.connectionId) return;

        // Get persona settings
        const [persona] = await db.select({
            meetingReminderEnabled: aiPersonas.meetingReminderEnabled,
            meetingReminderMinutes: aiPersonas.meetingReminderMinutes,
        })
            .from(aiPersonas)
            .where(eq(aiPersonas.id, conversation.personaId))
            .limit(1);

        if (!persona || !persona.meetingReminderEnabled) return;

        // Check if we're within the reminder window
        const now = new Date();
        const meetingTime = new Date(meeting.scheduledAt);
        const minutesUntilMeeting = (meetingTime.getTime() - now.getTime()) / (60 * 1000);

        // Send reminder when we're within the configured minutes
        if (minutesUntilMeeting > persona.meetingReminderMinutes || minutesUntilMeeting < 0) {
            return; // Not yet time, or already passed
        }

        // Get connection info
        const [connectionData] = await db.select({
            connectionType: connections.connectionType,
        })
            .from(connections)
            .where(eq(connections.id, conversation.connectionId))
            .limit(1);

        if (!connectionData) return;

        // Build reminder message
        const timeStr = meetingTime.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
        });
        const dateStr = meetingTime.toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
        });

        let minutesLabel: string;
        if (persona.meetingReminderMinutes <= 5) {
            minutesLabel = '5 minutos';
        } else if (persona.meetingReminderMinutes <= 30) {
            minutesLabel = '30 minutos';
        } else {
            minutesLabel = '1 hora';
        }

        let reminderText = `📅 *Lembrete de Reunião*\n\nOlá${contact.name ? ` ${contact.name.split(' ')[0]}` : ''}! Sua reunião começa em *${minutesLabel}*.\n\n🕐 *Horário:* ${timeStr} — ${dateStr}`;

        if (meeting.title) {
            reminderText += `\n📋 *Assunto:* ${meeting.title}`;
        }

        if (meeting.meetLink) {
            reminderText += `\n\n🔗 *Entre aqui:* ${meeting.meetLink}`;
        }

        reminderText += `\n\nTe esperamos! 😊`;

        // Send via WhatsApp
        const isBaileys = connectionData.connectionType === 'baileys';

        const sendResult = await sendUnifiedMessage({
            provider: isBaileys ? 'baileys' : 'apicloud',
            connectionId: conversation.connectionId,
            to: contact.phone,
            message: reminderText,
        });

        if (sendResult.success) {
            // Save message to chat
            await db.insert(messages).values({
                companyId: meeting.companyId,
                conversationId: conversation.id,
                senderType: 'AI',
                senderId: 'meeting_reminder',
                content: reminderText,
                contentType: 'TEXT',
                status: 'sent',
                providerMessageId: sendResult.messageId || null,
                sentAt: new Date(),
            });

            // Mark reminder as sent
            await db.update(aiScheduledMeetings)
                .set({ reminderSent: true })
                .where(eq(aiScheduledMeetings.id, meeting.id));

            console.log(`[MeetingReminder] ✅ Reminder sent for meeting ${meeting.id} — ${contact.name || contact.phone} (${minutesLabel} before)`);
        } else {
            console.error(`[MeetingReminder] ❌ Failed to send reminder for meeting ${meeting.id}`);
        }
    }
}

export const meetingReminderService = new MeetingReminderService();
