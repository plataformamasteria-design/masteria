/**
 * Next.js Instrumentation Hook
 * This file is called automatically when the server starts
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] 🚀 Server-side initialization starting...');

    // ✅ PERFORMANCE FIX: Pular workers que dependem de Redis em desenvolvimento local
    const isLocalDev = process.platform === 'win32' && process.env.NODE_ENV !== 'production';
    const hasRedis = !!(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDISHOST);

    if (!isLocalDev || hasRedis) {
      // Initialize Media Upload Queue (requer Redis)
      try {
        const { initializeMediaUploadQueue } = await import('./src/services/media-upload-queue.service');
        console.log('[Instrumentation] Initializing MediaUploadQueue...');
        await initializeMediaUploadQueue();
        console.log('[Instrumentation] ✅ MediaUploadQueue initialized');
      } catch (error) {
        console.error('[Instrumentation] ❌ Failed to initialize MediaUploadQueue:', error);
      }

      // Initialize Campaign Trigger Worker (requer Redis)
      try {
        const { initializeCampaignTriggerWorker } = await import('./src/workers/campaign-trigger.worker');
        console.log('[Instrumentation] Initializing CampaignTriggerWorker...');
        await initializeCampaignTriggerWorker();
        console.log('[Instrumentation] ✅ CampaignTriggerWorker initialized');
      } catch (error) {
        console.error('[Instrumentation] ❌ Failed to initialize CampaignTriggerWorker:', error);
      }
    } else {
      console.log('[Instrumentation] ⏭️ Skipping Redis-dependent workers (local dev without Redis)');
    }

    // Initialize Baileys Bridge: WebSocket listener + auto-resume sessions via microservice
    // Using setImmediate to not block server startup
    setImmediate(async () => {
      try {
        const { initBaileysWSListener } = await import('./src/lib/baileys-ws-listener');
        initBaileysWSListener();
        console.log('[Instrumentation] ✅ Baileys WS listener initialized');
      } catch (error) {
        console.error('[Instrumentation] ❌ Failed to init Baileys WS listener:', error);
      }

      try {
        const { baileysBridge } = await import('./src/lib/baileys-bridge-client');
        console.log('[Instrumentation] 🔄 Starting WhatsApp session auto-resume via bridge...');
        const result = await baileysBridge.resumeAllSessions();
        console.log(`[Instrumentation] ✅ WhatsApp sessions resumed: ${result.success} success, ${result.failed} failed`);
      } catch (error) {
        console.error('[Instrumentation] ❌ Failed to resume WhatsApp sessions:', error);
      }

      // Start Automation Timeout Worker
      try {
        const { initializeAutomationTimeoutWorker } = await import('./src/workers/automation-timeout.worker');
        console.log('[Instrumentation] Initializing AutomationTimeoutWorker...');
        await initializeAutomationTimeoutWorker();
        console.log('[Instrumentation] ✅ AutomationTimeoutWorker initialized');
      } catch (error) {
        console.error('[Instrumentation] ❌ Failed to initialize AutomationTimeoutWorker:', error);
      }

      // Start periodic unattended leads monitor (every 5 minutes)
      try {
        const { startUnattendedLeadsMonitor } = await import('./src/services/unattended-leads.service');
        startUnattendedLeadsMonitor();
        console.log('[Instrumentation] ✅ UnattendedLeadsMonitor started');
      } catch (error) {
        console.error('[Instrumentation] ❌ Failed to start UnattendedLeadsMonitor:', error);
      }

      // Start pending messages auto-responder (every 60 seconds)
      try {
        const mod = await import('./src/services/pending-messages-responder.service');
        const service = mod.pendingMessagesResponder || mod.default;
        if (service && typeof service.start === 'function') {
           service.start();
           console.log('[Instrumentation] ✅ Pending messages auto-responder started');
        } else {
           console.warn('[Instrumentation] ⚠️ pendingMessagesResponder could not be loaded');
        }
      } catch (err) {
        console.error('[Instrumentation] ❌ Failed to start pending messages responder:', err);
      }

      // Start meeting reminder checker (every 60 seconds)
      try {
        const mod = await import('./src/services/meeting-reminder.service');
        const service = mod.meetingReminderService || mod.default;
        if (service && typeof service.start === 'function') {
           service.start();
           console.log('[Instrumentation] ✅ Meeting reminder service started');
        } else {
           console.warn('[Instrumentation] ⚠️ meetingReminderService could not be loaded');
        }
      } catch (err) {
        console.error('[Instrumentation] ❌ Failed to start meeting reminder service:', err);
      }
    });
  }
}
