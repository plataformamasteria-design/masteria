import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import next from 'next';
import { initializeSocketIO } from './lib/socket';

// Force dev mode if explicit flag or missing NODE_ENV
const dev = process.env.NODE_ENV !== 'production' || !process.env.NODE_ENV;
console.log(`[Server] Starting in ${dev ? 'DEVELOPMENT' : 'PRODUCTION'} mode (NODE_ENV=${process.env.NODE_ENV})`);
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '5000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Track if Next.js is ready
let nextReady = false;

// Guard: Kill stale processes on port 5000 (Replit fix)
if (process.platform !== 'win32') {
  try {
    const { execSync } = require('child_process');
    const safePort = parseInt(String(port), 10);
    if (!Number.isInteger(safePort) || safePort < 1 || safePort > 65535) {
      throw new Error(`Invalid port number: ${port}`);
    }
    console.log(`🛡️ [Guard] Checking port ${safePort}...`);
    execSync(`fuser -k ${safePort}/tcp || true`);
    console.log(`✅ [Guard] Port ${safePort} cleared`);
  } catch (e) {
    console.warn(`⚠️ [Guard] Cleanup warning: ${(e as Error).message}`);
  }
}

// Create server that responds to health checks immediately
const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || '';

  // Always respond to health checks immediately (critical for deployment)
  // Use a minimal response to ensure it's lightning fast and doesn't hit the DB
  if (url === '/health' || url === '/api/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'close'
    });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // If Next.js isn't ready yet, return 503 Service Unavailable
  if (!nextReady) {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('Server is starting up, please wait...');
    return;
  }

  // Internal Socket.IO Emit API (Intercepted before Next.js)
  if (req.method === 'POST' && url === '/api/internal/socket-emit') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.secret !== process.env.JWT_SECRET_KEY_CALL) {
          res.writeHead(401);
          res.end('Unauthorized');
          return;
        }
        const { getSocketIO } = require('./lib/socket');
        const io = getSocketIO();
        if (io) {
          if (data.room) {
            io.to(data.room).emit(data.event, data.payload);
          } else {
            io.emit(data.event, data.payload);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Socket.io not initialized' }));
        }
      } catch (err) {
        res.writeHead(400);
        res.end('Bad Request');
      }
    });
    return;
  }

  // Normal Next.js handling
  try {
    const parsedUrl = parse(url, true);
    await handle(req, res, parsedUrl);
  } catch (err) {
    console.error('Error occurred handling', req.url, err);
    res.statusCode = 500;
    res.end('internal server error');
  }
});

// Initialize Socket.IO immediately
try {
  const io = initializeSocketIO(server);
  console.log('[Server] Socket.IO initialized');
} catch (e) {
  console.error('[Server] Failed to initialize Socket.IO:', e);
}

// START LISTENING IMMEDIATELY to pass health checks
server.listen(port, hostname, () => {
  console.log(`> Server listening on http://${hostname}:${port} (health check ready)`);
  console.log(`> Preparing Next.js...`);

  // Prepare Next.js in background
  app.prepare().then(() => {
    nextReady = true;
    console.log(`> Next.js ready on http://${hostname}:${port}`);

    // Initialize Workers AFTER Next.js is ready (non-blocking)
    // SKIP if instrumentationHook is enabled (Next.js handles it via instrumentation.ts)
    const instrumentationEnabled = process.env.NEXT_RUNTIME === 'nodejs';
    if (!instrumentationEnabled) {
      console.log('[Server] Instrumentation not active, initializing workers manually...');
      setImmediate(async () => {
        try {
          const { initializeCampaignTriggerWorker } = await import('./workers/campaign-trigger.worker');
          await initializeCampaignTriggerWorker();
          console.log('[Server] CampaignTriggerWorker initialized');
          
          const { initializeAutomationTimeoutWorker } = await import('./workers/automation-timeout.worker');
          await initializeAutomationTimeoutWorker();
          console.log('[Server] AutomationTimeoutWorker initialized');
        } catch (e) {
          console.error('[Server] Failed to initialize workers:', e);
        }

        // ✅ v2: Retry Baileys bridge init with exponential backoff
        await initBaileysWithRetry(5, 3000);
      });
    } else {
      console.log('[Server] Instrumentation active, workers initialized via instrumentation.ts');
    }
  }).catch((err) => {
    console.error('[Server] Failed to prepare Next.js:', err);
    process.exit(1);
  });
});

// ✅ Baileys Bridge initialization with retry and exponential backoff
async function initBaileysWithRetry(maxRetries: number, baseDelay: number): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { baileysBridge } = await import('./lib/baileys-bridge-client');
      const { initBaileysWSListener } = await import('./lib/baileys-ws-listener');

      // Check if microservice is reachable before proceeding
      const isHealthy = await baileysBridge.healthCheck();
      if (!isHealthy && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`[Server] Baileys microservice not ready (attempt ${attempt}/${maxRetries}). Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Connect WS listener to Baileys microservice
      // ✅ The listener now auto-resumes sessions on connect, so no need for manual resumeAllSessions here
      initBaileysWSListener();
      console.log('[Server] ✅ Baileys WS listener initialized successfully');
      return;
    } catch (e) {
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.error(`[Server] Failed to initialize Baileys bridge (attempt ${attempt}/${maxRetries}):`, e);
      if (attempt < maxRetries) {
        console.log(`[Server] Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('[Server] ❌ All Baileys bridge init attempts failed. The WS monitor will keep retrying in background.');
}
