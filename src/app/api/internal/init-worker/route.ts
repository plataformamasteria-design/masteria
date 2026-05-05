// ✅ INTERNAL API - Server-only worker initialization
// This route handler is GUARANTEED to be server-side only
// Webpack will NEVER try to bundle this for the client

import { type NextRequest, NextResponse } from 'next/server';

let workerInitialized = false;
let unattendedMonitorInterval: NodeJS.Timeout | null = null;

const REDIS_LOCK_KEY = 'unattended_leads_monitor:lock';
const REDIS_LOCK_TTL = 180; // 3 minutes (longer than 90s cycle timeout + overhead)
let currentLockToken: string | null = null;

function generateLockToken(): string {
  return `${process.pid || 'unknown'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function acquireRedisLock(): Promise<boolean> {
  try {
    const redis = require('@/lib/redis').default;
    if (!redis) {
      console.warn('[UnattendedMonitor] Redis unavailable - single instance mode');
      return true;
    }

    const token = generateLockToken();
    const result = await redis.set(REDIS_LOCK_KEY, token, 'EX', REDIS_LOCK_TTL, 'NX');

    if (result === 'OK') {
      currentLockToken = token;
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[UnattendedMonitor] Redis lock unavailable, proceeding in single instance mode');
    return true;
  }
}

async function releaseRedisLock(): Promise<void> {
  if (!currentLockToken) return;

  try {
    const redis = require('@/lib/redis').default;
    if (!redis) return;

    // Only release if we own the lock (Lua script for atomicity)
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    await redis.eval(luaScript, 1, REDIS_LOCK_KEY, currentLockToken);
    currentLockToken = null;
  } catch {
    // Ignore lock release errors
  }
}

async function renewLockTTL(): Promise<boolean> {
  if (!currentLockToken) return false;

  try {
    const redis = require('@/lib/redis').default;
    if (!redis) return false;

    // Only renew if we still own the lock
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await redis.eval(luaScript, 1, REDIS_LOCK_KEY, currentLockToken, REDIS_LOCK_TTL);
    return result === 1;
  } catch {
    return false;
  }
}

async function getActiveCompanyIds(): Promise<string[]> {
  try {
    const { db } = require('@/lib/db');
    const { companies } = require('@/lib/db/schema');
    const { eq } = require('drizzle-orm');

    const activeCompanies = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.isActive, true))
      .limit(100);

    return activeCompanies.map((c: any) => c.id);
  } catch {
    return []; // Return empty if can't get companies
  }
}

function startUnattendedLeadsMonitor() {
  if (unattendedMonitorInterval) {
    console.log('[UnattendedMonitor] Monitor already running');
    return;
  }

  const MONITOR_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  const MAX_LEADS_PER_TENANT = 2;
  const MAX_TENANTS_PER_CYCLE = 10;

  const ENABLE_GLOBAL_RECOVERY = process.env.ENABLE_GLOBAL_LEAD_RECOVERY !== 'false';

  if (!ENABLE_GLOBAL_RECOVERY) {
    console.log('[UnattendedMonitor] ⏸️ Global lead recovery is disabled (ENABLE_GLOBAL_LEAD_RECOVERY=false)');
    return;
  }

  console.log('[UnattendedMonitor] 🔄 Starting unattended leads monitor (every 5 minutes)');
  console.log('[UnattendedMonitor] 🔒 Using distributed Redis lock for multi-instance safety');
  console.log('[UnattendedMonitor] 👥 Processing per-tenant with limits');

  const runCheck = async () => {
    // Try to acquire distributed lock
    const lockAcquired = await acquireRedisLock();
    if (!lockAcquired) {
      console.log('[UnattendedMonitor] 🔒 Another instance is processing, skipping...');
      return;
    }

    const startTime = Date.now();

    try {
      const { detectUnattendedLeads, recoverUnattendedLead } = require('@/services/unattended-leads-detector.service');

      // Get active tenants and process each one
      const companyIds = await getActiveCompanyIds();

      if (companyIds.length === 0) {
        // Fallback to global mode if no companies found
        const unattendedLeads = await detectUnattendedLeads();
        if (unattendedLeads.length > 0) {
          console.log(`[UnattendedMonitor] Found ${unattendedLeads.length} unattended leads (global fallback)`);
          for (const lead of unattendedLeads.slice(0, MAX_LEADS_PER_TENANT * 2)) {
            if (Date.now() - startTime > 90000) break;
            try {
              await recoverUnattendedLead(lead);
              await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (err: any) {
              console.error(`[UnattendedMonitor] Recovery error:`, err.message);
            }
          }
        }
        return;
      }

      let totalRecovered = 0;
      const tenantsToProcess = companyIds.slice(0, MAX_TENANTS_PER_CYCLE);
      let tenantsProcessed = 0;

      for (const companyId of tenantsToProcess) {
        if (Date.now() - startTime > 90000) {
          console.log('[UnattendedMonitor] ⏱️ Cycle timeout reached, stopping');
          break;
        }

        // Renew lock every 3 tenants to prevent expiration
        if (tenantsProcessed > 0 && tenantsProcessed % 3 === 0) {
          const renewed = await renewLockTTL();
          if (!renewed) {
            console.warn('[UnattendedMonitor] ⚠️ Lost lock ownership, stopping cycle');
            break;
          }
        }
        tenantsProcessed++;

        try {
          const leads = await detectUnattendedLeads(companyId);

          if (leads.length === 0) continue;

          console.log(`[UnattendedMonitor] 🏢 Tenant ${companyId.slice(0, 8)}...: ${leads.length} leads`);

          for (const lead of leads.slice(0, MAX_LEADS_PER_TENANT)) {
            if (Date.now() - startTime > 90000) break;

            try {
              const result = await recoverUnattendedLead(lead);
              if (result.success) totalRecovered++;
              await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (err: any) {
              console.error(`[UnattendedMonitor] Recovery error for ${lead.contactName}:`, err.message);
            }
          }
        } catch (err: any) {
          console.error(`[UnattendedMonitor] Error processing tenant ${companyId}:`, err.message);
        }
      }

      if (totalRecovered > 0) {
        console.log(`[UnattendedMonitor] ✅ Recovered ${totalRecovered} leads across ${tenantsToProcess.length} tenants`);
      }
    } catch (error: any) {
      console.error('[UnattendedMonitor] Error during check:', error.message);
    } finally {
      await releaseRedisLock();
    }
  };

  setTimeout(() => {
    runCheck();
    unattendedMonitorInterval = setInterval(runCheck, MONITOR_INTERVAL_MS);
  }, 60000);
}

/**
 * Internal route to initialize campaign trigger worker
 * Called once on application startup via app initialization
 */
export async function GET(request: NextRequest) {
  return handleWorkerInit(request);
}

export async function POST(request: NextRequest) {
  return handleWorkerInit(request);
}

async function handleWorkerInit(request: NextRequest) {
  // Verify this is an internal request (same origin, no auth required for internal calls)
  const host = request.headers.get('host') || '';

  // Allow localhost, Replit domains, replit.app, and production domain
  // Also allow requests from within the same deployment (no host or local IPs)
  const allowedPatterns = [
    'localhost',
    'replit.dev',
    'replit.app',
    'repl.co',
    'masteria.app',
    'railway.app',
    '127.0.0.1',
    '0.0.0.0',
  ];

  const isInternal = allowedPatterns.some(pattern => host.includes(pattern)) || host === '';

  if (!isInternal) {
    console.warn(`[InitWorkerRoute] ⚠️ Blocked request from host: ${host}`);
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    );
  }

  // Initialize worker only once
  if (workerInitialized) {
    return NextResponse.json({
      status: 'already_initialized',
      message: 'Campaign trigger worker is already running'
    });
  }

  // ✅ PERFORMANCE FIX: No Windows sem Redis configurado, pular workers que dependem de Redis
  const isWindows = process.platform === 'win32';
  const hasRedis = !!(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDISHOST);

  if (isWindows && !hasRedis) {
    workerInitialized = true;
    console.log('[InitWorkerRoute] ⏭️ Skipping Redis-dependent workers (Windows dev without Redis)');

    // Ainda iniciar serviços que NÃO dependem de Redis
    setImmediate(async () => {
      try {
        const { initBaileysWSListener } = require('@/lib/baileys-ws-listener');
        initBaileysWSListener();
        console.log('[InitWorkerRoute] ✅ Baileys WS listener initialized (no-Redis mode)');
      } catch (err) {
        console.error('[InitWorkerRoute] ⚠️ Baileys WS listener failed:', err);
      }
    });

    return NextResponse.json({
      status: 'success',
      message: 'Workers initialized in no-Redis mode (Windows dev)'
    });
  }

  try {
    // ✅ Dynamic import of Node.js code - GUARANTEED server-side
    // eslint-disable-next-line global-require
    const { initializeCampaignTriggerWorker } = require('@/workers/campaign-trigger.worker');
    // eslint-disable-next-line global-require
    const { initializeAutomationTimeoutWorker } = require('@/workers/automation-timeout.worker');
    // eslint-disable-next-line global-require
    const { baileysBridge: sessionManager } = require('@/lib/baileys-bridge-client');

    // Initialize Baileys WS Listener for real-time events
    try {
      const { initBaileysWSListener } = require('@/lib/baileys-ws-listener');
      initBaileysWSListener();
      console.log('[InitWorkerRoute] ✅ Baileys WS listener initialized');
    } catch (wsErr) {
      console.error('[InitWorkerRoute] ⚠️ Baileys WS listener failed:', wsErr);
    }

    console.log('[InitWorkerRoute] 🚀 Initializing campaign trigger worker...');

    // Fire-and-forget with timeout
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => {
        console.warn('[InitWorkerRoute] ⚠️ Worker initialization timeout after 30s');
        resolve(false);
      }, 30000);
    });

    const success = await Promise.race([
      initializeCampaignTriggerWorker(),
      timeoutPromise
    ]);

    await Promise.race([
      initializeAutomationTimeoutWorker(),
      timeoutPromise
    ]);

    workerInitialized = true;

    // Auto-resume WhatsApp sessions via microservice
    // Using setImmediate to not block the response
    setImmediate(async () => {
      try {
        console.log('[InitWorkerRoute] 🚀 Triggering WhatsApp Auto-Resume via Bridge...');
        const result = await sessionManager.resumeAllSessions();
        console.log(`[InitWorkerRoute] ✅ WhatsApp Auto-Resume finished: ${result.success} resumed, ${result.failed} failed`);
      } catch (error) {
        console.error('[InitWorkerRoute] ❌ WhatsApp Auto-Resume failed:', error);
      }

      // Start periodic unattended leads monitor (every 5 minutes)
      startUnattendedLeadsMonitor();

      // Start pending messages auto-responder (every 60 seconds)
      try {
        const mod = require('@/services/pending-messages-responder.service');
        const service = mod.pendingMessagesResponder || mod.default;
        if (service && typeof service.start === 'function') {
           service.start();
           console.log('[InitWorkerRoute] ✅ Pending messages auto-responder started');
        } else {
           console.warn('[InitWorkerRoute] ⚠️ pendingMessagesResponder could not be loaded');
        }
      } catch (err) {
        console.error('[InitWorkerRoute] ❌ Failed to start pending messages responder:', err);
      }

      // Start meeting reminder checker (every 60 seconds)
      try {
        const mod = require('@/services/meeting-reminder.service');
        const service = mod.meetingReminderService || mod.default;
        if (service && typeof service.start === 'function') {
           service.start();
           console.log('[InitWorkerRoute] ✅ Meeting reminder service started');
        } else {
           console.warn('[InitWorkerRoute] ⚠️ meetingReminderService could not be loaded');
        }
      } catch (err) {
        console.error('[InitWorkerRoute] ❌ Failed to start meeting reminder service:', err);
      }
    });

    if (success) {
      console.log('[InitWorkerRoute] ✅ Campaign trigger worker initialized successfully');
      return NextResponse.json({
        status: 'success',
        message: 'Campaign trigger worker initialized successfully'
      });
    } else {
      console.warn('[InitWorkerRoute] ⚠️ Worker did not initialize within timeout');
      return NextResponse.json({
        status: 'timeout',
        message: 'Worker initialization timed out (Redis may not be available)'
      });
    }
  } catch (error) {
    console.error('[InitWorkerRoute] ❌ Error initializing worker:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to initialize campaign trigger worker',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
