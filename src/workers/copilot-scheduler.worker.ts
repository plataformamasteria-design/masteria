import { db } from '@/lib/db';
import { copilotScheduledTasks, conversations, connections, messages as messagesTable, contacts } from '@/lib/db/schema';
import { and, eq, lte, asc } from 'drizzle-orm';
import { executeCopilotCommand } from '@/lib/copilot-engine';
import { sendUnifiedMessage } from '@/services/unified-message-sender.service';
import { emitToCompany } from '@/lib/socket';

const POLLING_INTERVAL_MS = 60000; // Check every minute

let pollingInterval: NodeJS.Timeout | null = null;
let isProcessing = false;
let isInitialized = false;

declare global {
  // eslint-disable-next-line no-var
  var __copilotSchedulerWorkerInitialized: boolean | undefined;
  // eslint-disable-next-line no-var
  var __copilotSchedulerPollingInterval: NodeJS.Timeout | undefined;
}

async function processScheduledTasks(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();
    
    // Find all pending tasks that should be executed now or in the past
    const pendingTasks = await db.query.copilotScheduledTasks.findMany({
      where: and(
        eq(copilotScheduledTasks.status, 'pending'),
        lte(copilotScheduledTasks.executeAt, now)
      ),
      orderBy: [asc(copilotScheduledTasks.executeAt)],
      limit: 10 // process in batches
    });

    let processedCount = 0;

    for (const task of pendingTasks) {
      console.log(`[CopilotScheduler] ⏰ Executing scheduled task ${task.id}: "${task.prompt.slice(0, 50)}..."`);
      
      try {
        // Execute the AI command silently
        const res = await executeCopilotCommand(task.prompt, task.companyId, task.conversationId || undefined, 30);
        
        if (res.reply && task.conversationId && task.contactId) {
            // Fetch conversation and connection to send message back
            const activeConv = await db.query.conversations.findFirst({
                where: eq(conversations.id, task.conversationId)
            });
            const contact = await db.query.contacts.findFirst({
                where: eq(contacts.id, task.contactId)
            });

            if (activeConv && contact && activeConv.connectionId) {
                const connection = await db.query.connections.findFirst({
                    where: eq(connections.id, activeConv.connectionId)
                });

                if (connection) {
                    // Send the message to the user
                    const sendResult = await sendUnifiedMessage({
                        provider: (connection.connectionType as any) || 'evolution',
                        connectionId: connection.id,
                        to: contact.phone,
                        message: res.reply,
                    });

                    if (sendResult.success) {
                        // Save to DB and emit to Socket (just like flow-engine)
                        const [savedMessage] = await db.insert(messagesTable).values({
                            companyId: task.companyId,
                            conversationId: activeConv.id,
                            connectionId: connection.id,
                            senderType: 'AI',
                            senderId: 'copilot_scheduler',
                            content: res.reply,
                            contentType: 'TEXT',
                            providerMessageId: sendResult.messageId || `auto-${Date.now()}`,
                            status: 'SENT',
                        }).returning();

                        if (savedMessage) {
                            emitToCompany(task.companyId, 'chat:new-message', {
                                conversationId: activeConv.id,
                                messageId: savedMessage.id,
                                connectionId: connection.id,
                                contactPhone: contact.phone,
                                contactName: contact.name,
                                content: savedMessage.content,
                                contentType: savedMessage.contentType,
                                isFromMe: true,
                                senderType: 'AGENT',
                                timestamp: new Date().toISOString(),
                            });
                            emitToCompany(task.companyId, 'inbox:update', { timestamp: Date.now() });
                        }
                    } else {
                        console.error(`[CopilotScheduler] Failed to send message for task ${task.id}:`, sendResult.error);
                    }
                }
            }
        }

        // Mark as completed
        await db.update(copilotScheduledTasks)
          .set({ status: 'completed', result: res.reply, updatedAt: new Date() })
          .where(eq(copilotScheduledTasks.id, task.id));
          
        processedCount++;
      } catch (e: any) {
        console.error(`[CopilotScheduler] ❌ Task ${task.id} failed:`, e);
        // Mark as failed
        await db.update(copilotScheduledTasks)
          .set({ status: 'failed', result: e.message, updatedAt: new Date() })
          .where(eq(copilotScheduledTasks.id, task.id));
      }
    }

    if (processedCount > 0) {
      console.log(`[CopilotScheduler] ✅ Processed ${processedCount} scheduled AI tasks.`);
    }

  } catch (error) {
    console.error('[CopilotScheduler] ❌ Error checking scheduled tasks:', error);
  } finally {
    isProcessing = false;
  }
}

async function initializeCopilotSchedulerWorker(): Promise<boolean> {
  if (global.__copilotSchedulerWorkerInitialized) {
    return true;
  }
  if (isInitialized) return true;

  try {
    if (global.__copilotSchedulerPollingInterval) {
      clearInterval(global.__copilotSchedulerPollingInterval);
    }

    // Run once immediately
    await processScheduledTasks();

    pollingInterval = setInterval(processScheduledTasks, POLLING_INTERVAL_MS);
    global.__copilotSchedulerPollingInterval = pollingInterval;

    isInitialized = true;
    global.__copilotSchedulerWorkerInitialized = true;

    console.log(`[CopilotScheduler] ✅ Worker started successfully. Polling every ${POLLING_INTERVAL_MS / 1000}s`);
    return true;
  } catch (error) {
    console.error('[CopilotScheduler] ❌ Failed to start worker:', error);
    return false;
  }
}

async function shutdownCopilotSchedulerWorker(): Promise<void> {
  try {
    if (pollingInterval) clearInterval(pollingInterval);
    if (global.__copilotSchedulerPollingInterval) clearInterval(global.__copilotSchedulerPollingInterval);
    isInitialized = false;
    global.__copilotSchedulerWorkerInitialized = false;
  } catch (error) {}
}

export {
  initializeCopilotSchedulerWorker,
  shutdownCopilotSchedulerWorker,
  processScheduledTasks
};
