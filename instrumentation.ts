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
    });
  }
}
