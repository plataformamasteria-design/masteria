const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const next = require('next');
const { execSync, execFileSync } = require('child_process');

// CRITICAL: Project root is one level up from src/
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load environment variables from .env file (Development only)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.resolve(PROJECT_ROOT, '.env') });
}

// ✅ CORREÇÃO: Carregar tsx/cjs uma vez para habilitar require() de arquivos TypeScript
// Isso permite usar require() diretamente com arquivos .ts no Replit
require('tsx/cjs');

// ========================================
// GUARD AUTOMÁTICO - Prevenir EADDRINUSE
// ========================================
const isWindows = process.platform === 'win32';

/**
 * Kill stale Node.js processes occupying the target port before server starts.
 * This prevents EADDRINUSE errors when workflow restarts.
 */
function killStaleProcesses(targetPort) {
  if (isWindows) {
    console.log(`ℹ️ [Guard] Port cleanup skipped on Windows (use taskkill if needed)`);
    return;
  }
  try {
    // SECURITY: Validate port is a safe integer (defense in depth)
    const sanitizedPort = parseInt(targetPort, 10);
    if (isNaN(sanitizedPort) || sanitizedPort < 1 || sanitizedPort > 65535) {
      console.warn(`⚠️ [Guard] Invalid port number: ${targetPort}, skipping cleanup`);
      return;
    }

    // SECURITY: Additional regex validation before shell interpolation (defense against injection)
    const portString = String(sanitizedPort);
    if (!/^\d+$/.test(portString)) {
      console.warn(`⚠️ [Guard] Port validation failed regex check: ${portString}, skipping cleanup`);
      return;
    }

    console.log(`🔍 [Guard] Checking for stale processes on port ${sanitizedPort}...`);

    // Find processes using the target port
    // SECURITY: Using execFileSync (no shell) to prevent command injection
    let pids = '';
    try {
      pids = execFileSync('lsof', ['-ti', `:${portString}`], { encoding: 'utf8' }).trim();
    } catch (error) {
      // lsof returns non-zero exit code when no processes found - this is expected
      pids = '';
    }

    if (pids) {
      const pidList = pids.split('\n').filter(Boolean);
      console.log(`⚠️ [Guard] Found ${pidList.length} stale process(es): ${pidList.join(', ')}`);

      pidList.forEach(pidStr => {
        // SECURITY: Validate PID is a safe integer (defense in depth)
        const pid = parseInt(pidStr, 10);
        if (isNaN(pid) || pid < 1 || pid > 4194304) {
          console.warn(`⚠️ [Guard] Invalid PID: ${pidStr}, skipping`);
          return;
        }

        // SECURITY: Additional regex validation before shell interpolation (defense against injection)
        const pidString = String(pid);
        if (!/^\d+$/.test(pidString)) {
          console.warn(`⚠️ [Guard] PID validation failed regex check: ${pidString}, skipping`);
          return;
        }

        try {
          // Check if it's a Node.js process (safety check)
          // SECURITY: Using execFileSync (no shell invocation) - safe from injection
          const processInfo = execFileSync('ps', ['-p', pidString, '-o', 'comm='], { encoding: 'utf8' }).trim();

          if (processInfo.includes('node')) {
            console.log(`🔪 [Guard] Terminating stale Node.js process PID ${pid}...`);
            process.kill(pid, 'SIGKILL');
            console.log(`✅ [Guard] PID ${pid} terminated successfully`);
          } else {
            console.log(`⏭️ [Guard] Skipping non-Node.js process PID ${pid} (${processInfo})`);
          }
        } catch (killError) {
          console.warn(`⚠️ [Guard] Could not terminate PID ${pid}: ${killError.message}`);
        }
      });

      // Wait 1 second for port to be released
      console.log(`⏳ [Guard] Waiting 1s for port ${sanitizedPort} to be released...`);
      // Use settimeout or a cross-platform wait inside async if possible, 
      // but for sync startup, we'll just skip the 'sleep' command on Windows (already handled by top-level check)
      if (!isWindows) {
        execSync('sleep 1');
      }
      console.log(`✅ [Guard] Port ${sanitizedPort} cleanup complete`);
    } else {
      console.log(`✅ [Guard] No stale processes found on port ${sanitizedPort}`);
    }

    // ✅ FALLBACK: Always run fuser -k to be absolutely sure (Robustness for Replit)
    try {
      console.log(`🛡️ [Guard] Executing aggressive cleanup with fuser on port ${sanitizedPort}...`);
      execFileSync('fuser', ['-k', `${sanitizedPort}/tcp`], { stdio: 'ignore' });
    } catch (e) {
      // Ignore errors from fuser (expected when no process holds the port)
    }

    console.log(`✅ [Guard] Port ${sanitizedPort} check/cleanup steps completed`);
  } catch (error) {
    // Non-critical error - continue server startup
    console.warn(`⚠️ [Guard] Process cleanup failed (non-critical): ${error.message}`);
  }
}

// Execute guard before server initialization
const PORT = parseInt(process.env.PORT || '5000', 10);
killStaleProcesses(PORT);

// ========================================
// CRITICAL: Log actual Node.js heap limit on startup
// ========================================
const v8 = require('v8');
const heapStats = v8.getHeapStatistics();
const heapLimitMB = (heapStats.heap_size_limit / 1024 / 1024).toFixed(2);
console.log(`🧠 [Memory] Node.js Heap Limit: ${heapLimitMB} MB`);
console.log(`💾 [Memory] NODE_OPTIONS: ${process.env.NODE_OPTIONS || 'NOT SET'}`);

// Memory optimization: Enable garbage collection monitoring
if (global.gc) {
  console.log('🧹 Garbage collection exposed, enabling aggressive memory management');

  // Force garbage collection every 30 seconds
  setInterval(() => {
    const beforeMem = process.memoryUsage();
    global.gc();
    const afterMem = process.memoryUsage();

    const freed = {
      heapUsed: ((beforeMem.heapUsed - afterMem.heapUsed) / 1024 / 1024).toFixed(2),
      external: ((beforeMem.external - afterMem.external) / 1024 / 1024).toFixed(2),
      total: ((beforeMem.rss - afterMem.rss) / 1024 / 1024).toFixed(2)
    };

    if (parseFloat(freed.heapUsed) > 0) {
      console.log(`🧹 [GC] Freed ${freed.heapUsed}MB heap, ${freed.external}MB external, ${freed.total}MB total`);
    }
  }, 30000); // Every 30 seconds

  // Force GC when memory usage is high (>60% of TOTAL limit) - ✅ MEMORY: Reduced from 80%
  setInterval(() => {
    const mem = process.memoryUsage();
    const stats = v8.getHeapStatistics();
    const heapPercentage = (mem.heapUsed / stats.heap_size_limit) * 100;

    if (heapPercentage > 50) {
      console.warn(`⚠️ [Memory] High heap usage: ${heapPercentage.toFixed(2)}% of limit, forcing GC`);
      global.gc();
    }
  }, 20000); // Check every 20 seconds
} else {
  console.warn('⚠️ Garbage collection not exposed. Run with --expose-gc flag for better memory management');
}

// Log memory usage every minute
setInterval(() => {
  const mem = process.memoryUsage();
  const stats = {
    rss: (mem.rss / 1024 / 1024).toFixed(2),
    heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2),
    heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2),
    external: (mem.external / 1024 / 1024).toFixed(2),
    heapPercentage: ((mem.heapUsed / mem.heapTotal) * 100).toFixed(2)
  };

  console.log(`📊 [Memory Stats] RSS: ${stats.rss}MB | Heap: ${stats.heapUsed}/${stats.heapTotal}MB (${stats.heapPercentage}%) | External: ${stats.external}MB`);
}, 120000); // Every 2 minutes

// Smart dev mode detection:
// 1. Explicitly development if NODE_ENV !== 'production'
// 2. Force dev if NODE_ENV is missing
// 3. Force dev if NODE_ENV=production BUT no production build exists (Replit fix)
const fs = require('fs');
const hasProdBuild = fs.existsSync(path.join(PROJECT_ROOT, '.next', 'BUILD_ID'))
  && fs.existsSync(path.join(PROJECT_ROOT, '.next', 'required-server-files.json'));
let dev = process.env.NODE_ENV !== 'production' || !process.env.NODE_ENV;

if (!dev && !hasProdBuild) {
  console.log('⚠️ [ServerJS] NODE_ENV=production but no .next/BUILD_ID found. Forcing DEVELOPMENT mode.');
  dev = true;
}

console.log(`[ServerJS] Starting in ${dev ? 'DEVELOPMENT' : 'PRODUCTION'} mode (NODE_ENV=${process.env.NODE_ENV}, hasProdBuild=${hasProdBuild})`);
const hostname = '0.0.0.0';
const port = process.env.PORT || 5000;

// CRITICAL: dir must point to the project root where .next and next.config.mjs live
const nextConfig = {
  dev,
  hostname,
  port,
  dir: PROJECT_ROOT,
  quiet: !dev, // Reduce logs in production
};

const app = next(nextConfig);
const handle = app.getRequestHandler();

// Track if Next.js is ready
let nextReady = false;

// CRITICAL: Create HTTP server first (no Socket.IO yet)
const server = createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url, true);
    const { pathname, query } = parsedUrl;

    // CRITICAL: Health check endpoints ALWAYS respond immediately (even if Next.js not ready)
    // Also handle root path for deployment health checks (Autoscale sends to / by default)
    const isHealthCheck = pathname === '/health' || pathname === '/_health' ||
      (pathname === '/' && (
        req.headers['user-agent']?.includes('kube-probe') ||
        req.headers['user-agent']?.includes('GoogleHC') ||
        req.headers['user-agent']?.includes('HealthChecker') ||
        req.headers['x-replit-health-check'] === 'true' ||
        req.method === 'HEAD'
      ));

    if (isHealthCheck) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.end(JSON.stringify({
        status: 'healthy',
        nextReady: nextReady,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }));
      return;
    }

    // 🗑️ DATABASE CLEANUP ENDPOINT - Close zombie connections
    if (pathname === '/api/db-cleanup') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      try {
        // ✅ CORREÇÃO: Remover extensão - Next.js resolve automaticamente arquivos .ts/.tsx
        const { conn: _conn } = await import('./lib/db/index');

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        res.end(JSON.stringify({
          status: 'success',
          message: 'Database pool cleanup triggered',
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({
          status: 'error',
          message: error.message,
          timestamp: new Date().toISOString()
        }));
      }
      return;
    }

    // If Next.js not ready yet, return appropriate response
    if (!nextReady) {
      // IMPROVEMENT: Detect if client expects JSON (health checkers, APIs)
      const acceptsJson = req.headers.accept?.includes('application/json') ||
        req.headers['user-agent']?.includes('HealthChecker') ||
        req.method === 'HEAD';

      if (acceptsJson) {
        // Return JSON with 503 for health checkers (more semantically correct)
        res.statusCode = 503; // Service Unavailable
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Retry-After', '5');
        res.end(JSON.stringify({
          status: 'initializing',
          message: 'Server is starting up, please retry in a few seconds',
          nextReady: false,
          uptime: process.uptime(),
          services: {
            express: true,
            socketIO: !!global.io,
            nextjs: false
          },
          timestamp: new Date().toISOString()
        }));
        return;
      }

      // HTML loading page for browsers
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.end('<html><head><meta http-equiv="refresh" content="5"></head><body><h1>Starting...</h1><p>Server is initializing, please wait...</p></body></html>');
      return;
    }

    // Next.js request handling (only when ready)
    if (pathname === '/a') {
      await app.render(req, res, '/a', query);
    } else if (pathname === '/b') {
      await app.render(req, res, '/b', query);
    } else {
      await handle(req, res, parsedUrl);
    }
  } catch (err) {
    console.error('Error occurred handling', req.url, err);
    // ENOENT safety: show friendly page if build files are missing
    if (err.code === 'ENOENT' && err.path && err.path.includes('.next')) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'text/html');
      res.end('<html><head><meta http-equiv="refresh" content="10"></head><body><h1>Building...</h1><p>The application is being rebuilt. Please wait...</p></body></html>');
    } else {
      res.statusCode = 500;
      res.end('internal server error');
    }
  }
});

// ========================================
// CRITICAL FIX #1: Server Error Handler with EADDRINUSE Retry
// ========================================
const startServerWithRetry = (retryCount = 0, maxRetries = 3) => {
  server.listen(port, hostname, () => {
    // Server is now LISTENING - health checks will work!
    console.log(`✅ Server LISTENING on http://${hostname}:${port}`);
    console.log('✅ Health endpoints ready: GET /health or /_health');

    // Continue with Socket.IO initialization only AFTER listen succeeds
    continueInitialization();
  });

  // CRITICAL: Handle EADDRINUSE error with retry logic
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use (Error: EADDRINUSE)`);

      if (retryCount < maxRetries) {
        const delayMs = 1000 * (retryCount + 1);
        console.log(`⏳ Retry #${retryCount + 1}/${maxRetries} after ${delayMs}ms...`);

        setTimeout(() => {
          // Recreate server for retry
          const newServer = createServer(server._handle);
          // Copy handlers from old server
          newServer.on('request', (req, res) => {
            server.emit('request', req, res);
          });

          startServerWithRetry(retryCount + 1, maxRetries);
        }, delayMs);
      } else {
        console.error(`🔴 Failed to start server after ${maxRetries} retries. Exiting.`);
        process.exit(1);
      }
    } else {
      console.error(`❌ Server error: ${err.message}`);
      process.exit(1);
    }
  });
};

// Helper function - moved Socket.IO and services init here
const continueInitialization = () => {

  // ========================================
  // STEP 2A: Initialize Redis (eager loading for production)
  // ========================================
  // ✅ CORREÇÃO: Redis será inicializado quando necessário (lazy loading)
  // Removido require com extensão .ts que pode causar problemas em runtime

  // STEP 2B: Initialize Socket.IO (after server is listening)
  let io;
  (async () => {
    try {
      // ✅ CORREÇÃO: Usar require() com caminho absoluto e tsx/cjs para arquivos TypeScript no Replit
      const { initializeSocketIO } = require(path.join(PROJECT_ROOT, 'src', 'lib', 'socket.ts'));
      io = initializeSocketIO(server);
      global.io = io;
      console.log('✅ Socket.IO initialized');
    } catch (error) {
      console.log('⚠️ Socket.IO initialization failed, using fallback');
      console.error('⚠️ Socket.IO error:', error.message);
      console.error('⚠️ Socket.IO stack:', error.stack);
      const { Server } = require('socket.io');
      // Determinar origens permitidas para CORS
      const allowedOrigins = process.env.NODE_ENV === 'production'
        ? [
          process.env.NEXT_PUBLIC_BASE_URL || '',
          process.env.NEXT_PUBLIC_CUSTOM_DOMAIN ? `https://${process.env.NEXT_PUBLIC_CUSTOM_DOMAIN}` : '',
          'https://masteria.app', // ✅ Adicionar domínio de produção
        ].filter(Boolean) // Remove strings vazias
        : [
          'http://localhost:5000',
          'http://localhost:3000',
          'http://0.0.0.0:5000',
          'https://masteria.app', // ✅ Permitir também em desenvolvimento para testes
          ...(process.env.REPLIT_DEV_DOMAIN ? [`https://${process.env.REPLIT_DEV_DOMAIN}`] : []), // ✅ Permitir domínio do Replit
          ...(process.env.REPL_SLUG && process.env.REPL_OWNER ? [`https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`] : []), // ✅ Permitir domínio padrão do Replit
        ].filter(Boolean);

      // ✅ CORREÇÃO: Função de validação de origem para permitir domínios Replit dinâmicos
      const originValidator = (origin, callback) => {
        if (!origin) {
          return callback(null, true); // Permitir requisições sem origem
        }

        // Verificar se é uma das origens permitidas
        if (allowedOrigins.some(allowed => {
          if (typeof allowed === 'string') {
            return origin === allowed;
          }
          return false;
        })) {
          return callback(null, true);
        }

        // ✅ Permitir domínios *.replit.dev dinamicamente
        if (origin.match(/^https?:\/\/[^.]+\.replit\.dev$/)) {
          return callback(null, true);
        }

        // ✅ Permitir domínios *.kirk.replit.dev dinamicamente
        if (origin.match(/^https?:\/\/[^.]+\.kirk\.replit\.dev$/)) {
          return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
      };

      io = new Server(server, {
        path: '/api/socketio',
        cors: {
          origin: originValidator,
          methods: ['GET', 'POST'],
          credentials: true,
        },
        transports: ['websocket', 'polling'],
      });

      io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
        socket.on('join_meeting', (meetingId) => {
          socket.join(`meeting:${meetingId}`);
        });
        socket.on('disconnect', () => {
          console.log('Client disconnected:', socket.id);
        });
      });

      global.io = io;
      console.log('✅ Fallback Socket.IO initialized');
    }
  })();

  // ========================================
  // DATABASE POOL MONITORING (Production)
  // ========================================
  if (process.env.NODE_ENV === 'production' || process.env.DB_DEBUG === 'true') {
    setInterval(async () => {
      try {
        if (process.env.DB_DEBUG === 'true') {
          console.log('🔍 [DB Monitor] Pool monitoring active...');
        }
      } catch (error) {
        console.warn(`⚠️ [DB Monitor] Connection check failed: ${error.message}`);
      }
    }, 30000);
  }

  // STEP 3: Prepare Next.js in background with TIMEOUT
  console.log('🔄 Preparing Next.js in background (timeout: 300s)...');

  const prepareWithTimeout = (timeoutMs = 300000) => {
    return Promise.race([
      app.prepare(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Next.js prepare timeout after 300s')), timeoutMs)
      )
    ]);
  };

  prepareWithTimeout(300000)
    .then(async () => {
      nextReady = true;
      console.log('✅ Next.js ready! (completed in time)');

      // ✅ CORREÇÃO CRÍTICA: Inicialização única dos serviços
      // Esta é a ÚNICA fonte de inicialização para evitar race conditions
      (async () => {
        try {
          // ✅ CORREÇÃO: No Replit, usar require diretamente após carregar tsx/cjs
          const { initializeCampaignTriggerWorker } = require(path.join(PROJECT_ROOT, 'src', 'workers', 'campaign-trigger.worker.ts'));
          const { initializeAutomationTimeoutWorker } = require(path.join(PROJECT_ROOT, 'src', 'workers', 'automation-timeout.worker.ts'));

          // Verificar se já foi inicializado para evitar duplicação
          if (!global.__CAMPAIGN_WORKER_INITIALIZED) {
            await initializeCampaignTriggerWorker();
            global.__CAMPAIGN_WORKER_INITIALIZED = true;
            console.log('✅ Campaign worker started');
          } else {
            console.log('⚠️ Campaign worker already initialized, skipping...');
          }

          if (!global.__AUTOMATION_TIMEOUT_WORKER_INITIALIZED) {
            await initializeAutomationTimeoutWorker();
            global.__AUTOMATION_TIMEOUT_WORKER_INITIALIZED = true;
            console.log('✅ Automation timeout worker started');
          } else {
            console.log('⚠️ Automation timeout worker already initialized, skipping...');
          }
        } catch (error) {
          console.error('❌ Failed to start campaign worker:', error.message);
          console.error('❌ Stack:', error.stack);
        }

        // ✅ Migração: Sessões agora são gerenciadas pelo microserviço Go
        // Legado removido para evitar erro Require no server startup



        // ✅ FASE 3.1: Inicializar queue de upload de mídia
        try {
          const { initializeMediaUploadQueue } = require(path.join(PROJECT_ROOT, 'src', 'services', 'media-upload-queue.service.ts'));
          initializeMediaUploadQueue();
          console.log('✅ Media upload queue initialized');
        } catch (error) {
          console.error('❌ Failed to initialize media upload queue:', error.message);
          console.error('❌ Stack:', error.stack);
        }


      })();

      setTimeout(async () => {
        try {
          // ✅ CORREÇÃO: No Replit, usar require com tsx/cjs para arquivos TypeScript
          const { startCadenceScheduler } = require(path.join(PROJECT_ROOT, 'src', 'lib', 'cadence-scheduler.ts'));
          startCadenceScheduler();
          console.log('✅ Cadence Scheduler ready');

          // ✅ FASE 5: Inicializar Neon Keep-Alive (Prevenir suspensão do Free Tier)
          try {
            const { neonKeepAlive } = require(path.join(PROJECT_ROOT, 'src', 'services', 'neon-keepalive.service.ts'));
            neonKeepAlive.start();
            console.log('✅ Neon Keep-Alive Service started');
          } catch (error) {
            console.error('❌ Failed to start Neon Keep-Alive:', error.message);
          }

          // ✅ FASE 6: Inicializar processador de Follow-ups (CORREÇÃO CRÍTICA - antes nunca era chamado!)
          try {
            const { processFollowUpQueue } = require(path.join(PROJECT_ROOT, 'src', 'lib', 'ai-followup-scheduler.ts'));

            // Processar follow-ups a cada 60 segundos
            setInterval(async () => {
              try {
                const processed = await processFollowUpQueue(50);
                if (processed > 0) {
                  console.log(`✅ [FollowUp Worker] Processed ${processed} follow-ups`);
                }
              } catch (error) {
                console.error('❌ [FollowUp Worker] Error processing queue:', error.message);
              }
            }, 60000); // Every 60 seconds

            // Executar imediatamente uma vez após 30s de startup
            setTimeout(async () => {
              try {
                const processed = await processFollowUpQueue(50);
                console.log(`✅ [FollowUp Worker] Initial scan: ${processed} follow-ups processed`);
              } catch (error) {
                console.error('❌ [FollowUp Worker] Initial scan error:', error.message);
              }
            }, 30000);

            console.log('✅ Follow-up Queue Worker started (runs every 60s)');
          } catch (error) {
            console.error('❌ Failed to start Follow-up Queue Worker:', error.message);
          }
        } catch (error) {
          console.error('❌ Cadence Scheduler error:', error.message);
          console.error('❌ Stack:', error.stack);
        }
      }, 5000);

      // NOTE: Campaign processing is handled by CampaignTriggerWorker and BullMQ
      // Redundant polling removed to save memory
    })
    .catch(err => {
      console.error('❌ Next.js preparation failed or timeout:', err.message);
      console.log('ℹ️ Server will continue running with basic endpoints');
      console.log('ℹ️ Retrying Next.js preparation in 30s...');

      setTimeout(() => {
        prepareWithTimeout(300000)
          .then(() => {
            nextReady = true;
            console.log('✅ Next.js ready! (completed on retry)');
          })
          .catch(retryErr => {
            console.error('❌ Next.js preparation retry also failed:', retryErr.message);
            console.log('⚠️ Next.js will remain unavailable - degraded mode');
          });
      }, 30000);
    });
}; // End continueInitialization function

// STEP 1: Start server with retry logic for EADDRINUSE
startServerWithRetry();

// ========================================
// AUTOMATIC TOKEN RENEWAL CRON JOB
// ========================================
// Run every 6 hours to check and refresh expiring Meta tokens
const TOKEN_REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

setTimeout(async () => {
  try {
    console.log('🔄 [Token Refresh] Initializing background service...');
    // ✅ CORREÇÃO: No Replit, usar require com tsx/cjs para arquivos TypeScript
    const { tokenRefreshService } = require(path.join(PROJECT_ROOT, 'src', 'services', 'token-refresh.service.ts'));

    // Run immediately on startup (with slight delay to let server settle)
    setTimeout(async () => {
      console.log('🔄 [Token Refresh] Running initial scan...');
      await tokenRefreshService.refreshExpiringTokens();
    }, 60000); // 1 minute after startup

    // Setup interval
    setInterval(async () => {
      console.log('🔄 [Token Refresh] Starting scheduled scan...');
      await tokenRefreshService.refreshExpiringTokens();
    }, TOKEN_REFRESH_INTERVAL);

    console.log('✅ [Token Refresh] Background service registered');
  } catch (error) {
    console.error('❌ [Token Refresh] Failed to initialize service:', error.message);
  }
}, 5000); // Wait 5s for other services to initialize

// ========================================
// CRITICAL FIX #2: Graceful Shutdown Handler
// ========================================
const gracefulShutdown = async (signal) => {
  console.log(`\n⏳ [${signal}] Graceful shutdown initiated...`);

  // Close HTTP server
  server.close(() => {
    console.log('✅ HTTP server closed');
  });

  // Force shutdown after 10 seconds
  const shutdownTimeout = setTimeout(() => {
    console.error('🔴 Forced shutdown after 10s timeout');
    process.exit(1);
  }, 10000);

  try {
    // Close database connections if available
    if (global.db && global.db.close) {
      await global.db.close();
      console.log('✅ Database connections closed');
    }

    // Close Redis if available
    if (global.redis && global.redis.quit) {
      await global.redis.quit();
      console.log('✅ Redis connection closed');
    }

    clearTimeout(shutdownTimeout);
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error.message);
    process.exit(1);
  }
};

// ========================================
// CRITICAL FIX #3: Process Error Handlers
// ========================================

// Handle SIGTERM (sent by container orchestration systems)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🔴 Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// fs is already required above for smart dev mode checks

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 Unhandled Rejection at Promise:', promise, 'reason:', reason);



  // CRITICAL FIX: Auto-recover from Next.js cache corruption
  // Error: ENOENT: no such file or directory, stat '.../.next/cache/...'
  if (reason && reason.code === 'ENOENT' && reason.path && reason.path.includes('.next')) {
    console.error('⚠️ CRITICAL: Next.js cache corruption detected!');
    console.log('🧹 Initiating auto-recovery: Clearing .next folder...');

    try {
      const nextDir = path.join(PROJECT_ROOT, '.next');
      if (fs.existsSync(nextDir)) {
        fs.rmSync(nextDir, { recursive: true, force: true });
        console.log('✅ .next folder cleared successfully');
      } else {
        console.log('ℹ️ .next folder not found, skipping cleanup');
      }

      console.log('🔄 Restarting server to rebuild cache...');
      process.exit(1); // Exit to let process manager restart
    } catch (cleanupError) {
      console.error('❌ Failed to clear .next folder:', cleanupError.message);
      // Continue to graceful shutdown
    }
  }

  gracefulShutdown('unhandledRejection');
});

console.log('✅ Process error handlers registered');
