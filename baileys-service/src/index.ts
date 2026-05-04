/**
 * Baileys Microservice — Entry Point
 * Express + Socket.IO server on port 3001.
 * Drop-in replacement for the Go/WhatsMeow service.
 */

import { config } from './config';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import { initSocketIO } from './socket/emitter';
import { initAuthPool, ensureAuthTable } from './auth-state-postgres';
import { SessionManager } from './session-manager';
import { createApiRouter, apiKeyAuth } from './api/routes';

const serverStartTime = Date.now();

async function main() {
  logger.info('🚀 Starting Baileys Microservice...');

  // --- Initialize Database ---
  initAuthPool(config.databaseUrl);
  await ensureAuthTable();

  // --- Initialize Session Manager ---
  const sessionManager = new SessionManager(config.databaseUrl);

  // --- Express ---
  const app = express();
  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '10mb' }));

  // Health check (no auth required)
  app.get('/health', (_req, res) => {
    const stats = sessionManager.getSessionsStats();
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
    
    res.json({
      status: 'ok',
      service: 'baileys-service',
      runtime: 'node.js',
      timestamp: new Date().toISOString(),
      uptime: `${uptime}s`,
      sessions: {
        total: stats.total,
        byStatus: stats.byStatus,
      },
    });
  });

  // API routes (with auth)
  app.use('/api', apiKeyAuth(config.apiKey), createApiRouter(sessionManager));

  // --- HTTP + Socket.IO Server ---
  const httpServer = createServer(app);
  initSocketIO(httpServer);

  // --- Start Listening ---
  httpServer.listen(config.port, '0.0.0.0', () => {
    logger.info(`🚀 Baileys Service listening on port ${config.port}`);
    logger.info(`   Health: http://0.0.0.0:${config.port}/health`);
    logger.info(`   Socket.IO: ws://0.0.0.0:${config.port}/baileys-ws`);
    logger.info(`   API: http://0.0.0.0:${config.port}/api/sessions/*`);
  });

  // --- Auto-Resume Sessions ---
  setTimeout(async () => {
    logger.info('🔄 Starting auto-resume...');
    try {
      const { success, failed } = await sessionManager.resumeAllSessions();
      logger.info({ success, failed }, '✅ Sessions resumed');
    } catch (err) {
      logger.error({ err }, '❌ Auto-resume failed');
    }
  }, 2000);

  // --- Graceful Shutdown ---
  const shutdown = async (signal: string) => {
    logger.info({ signal }, '🛑 Shutting down...');
    httpServer.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => {
    logger.error({ err }, '🚨 Uncaught exception');
  });
  process.on('unhandledRejection', (err) => {
    logger.error({ err }, '🚨 Unhandled rejection');
  });
}

main().catch((err) => {
  logger.error({ err }, '💀 Fatal startup error');
  process.exit(1);
});
