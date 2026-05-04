/**
 * REST API Routes — 17 endpoints matching baileys-bridge-client.ts contract.
 * Drop-in replacement for the Go api.go handlers.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { SessionManager } from '../session-manager';
import { logger } from '../utils/logger';

export function createApiRouter(sm: SessionManager): Router {
  const router = Router();

  // POST /api/sessions/:connectionId/create
  router.post('/sessions/:connectionId/create', async (req: Request, res: Response) => {
    try {
      const connectionId = req.params.connectionId as string;
      const { companyId } = req.body;
      if (!companyId) { res.status(400).json({ error: 'companyId is required' }); return; }
      await sm.createSession(connectionId, companyId);
      res.json({ success: true });
    } catch (err: any) {
      logger.error({ err }, 'Create session error');
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sessions/:connectionId/send
  router.post('/sessions/:connectionId/send', async (req: Request, res: Response) => {
    try {
      const connectionId = req.params.connectionId as string;
      const { to, content } = req.body;
      if (!to || !content) { res.status(400).json({ error: 'to and content are required' }); return; }
      const messageId = await sm.sendMessage(connectionId, to, content);
      res.json({ success: true, messageId });
    } catch (err: any) {
      logger.error({ err }, 'Send message error');
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sessions/:connectionId/ensure
  router.post('/sessions/:connectionId/ensure', async (req: Request, res: Response) => {
    try {
      const connectionId = req.params.connectionId as string;
      const { companyId } = req.body;
      const result = sm.ensureSession(connectionId, companyId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/sessions/:connectionId
  router.delete('/sessions/:connectionId', async (req: Request, res: Response) => {
    try {
      const connectionId = req.params.connectionId as string;
      await sm.deleteSession(connectionId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/sessions/:connectionId/status
  router.get('/sessions/:connectionId/status', (req: Request, res: Response) => {
    const connectionId = req.params.connectionId as string;
    const session = sm.getSession(connectionId);
    res.json({
      connectionId,
      status: session?.status || null,
      phone: session?.phone || null,
      qr: session?.qr || null,
    });
  });

  // GET /api/sessions/:connectionId/qr
  router.get('/sessions/:connectionId/qr', (req: Request, res: Response) => {
    const connectionId = req.params.connectionId as string;
    const session = sm.getSession(connectionId);
    res.json({ qr: session?.qr || null, status: session?.status || 'not_found' });
  });

  // GET /api/sessions/:connectionId/qr/stream (SSE)
  router.get('/sessions/:connectionId/qr/stream', (req: Request, res: Response) => {
    const connectionId = req.params.connectionId as string;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });

    const session = sm.getSession(connectionId);
    if (session?.qr) res.write(`data: ${JSON.stringify({ qr: session.qr, status: session.status })}\n\n`);

    let lastQR = session?.qr || '';
    const interval = setInterval(() => {
      const current = sm.getSession(connectionId);
      if (!current) { res.write(`data: ${JSON.stringify({ status: 'not_found' })}\n\n`); clearInterval(interval); res.end(); return; }
      if (current.status === 'connected') { res.write(`data: ${JSON.stringify({ status: 'connected', phone: current.phone })}\n\n`); clearInterval(interval); res.end(); return; }
      if (current.qr && current.qr !== lastQR) { lastQR = current.qr; res.write(`data: ${JSON.stringify({ qr: current.qr, status: current.status })}\n\n`); }
    }, 2000);
    const timeout = setTimeout(() => { clearInterval(interval); res.write(`data: ${JSON.stringify({ status: 'timeout' })}\n\n`); res.end(); }, 180000);
    req.on('close', () => { clearInterval(interval); clearTimeout(timeout); });
  });

  // POST /api/sessions/:connectionId/clear-auth
  router.post('/sessions/:connectionId/clear-auth', async (req: Request, res: Response) => {
    try {
      const connectionId = req.params.connectionId as string;
      await sm.clearAuth(connectionId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sessions/:connectionId/sync-history
  router.post('/sessions/:connectionId/sync-history', async (req: Request, res: Response) => {
    try {
      const connectionId = req.params.connectionId as string;
      const { jid } = req.body;
      await sm.syncChatHistory(connectionId, jid);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sessions/:connectionId/validate-number
  router.post('/sessions/:connectionId/validate-number', async (req: Request, res: Response) => {
    try {
      const connectionId = req.params.connectionId as string;
      const { phoneNumber } = req.body;
      const result = await sm.validateWhatsAppNumber(connectionId, phoneNumber);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, exists: false });
    }
  });

  // GET /api/sessions/:connectionId/profile-picture
  router.get('/sessions/:connectionId/profile-picture', async (req: Request, res: Response) => {
    try {
      const jid = req.query.jid as string;
      if (!jid) { res.status(400).json({ error: 'jid query parameter is required' }); return; }
      const url = await sm.getProfilePicture(jid);
      res.json({ url });
    } catch {
      res.json({ url: null });
    }
  });

  // --- Batch Operations ---

  router.get('/sessions/stats', (_req: Request, res: Response) => {
    res.json(sm.getSessionsStats());
  });

  router.post('/sessions/batch-status', (req: Request, res: Response) => {
    const { connectionIds } = req.body;
    if (!Array.isArray(connectionIds)) { res.status(400).json({ error: 'connectionIds must be an array' }); return; }
    res.json(sm.getBatchSessionStatus(connectionIds));
  });

  router.post('/sessions/resume-all', async (_req: Request, res: Response) => {
    try {
      const result = await sm.resumeAllSessions();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/sessions/messages', async (_req: Request, res: Response) => {
    res.json({ messages: [], nextCursor: null });
  });

  router.get('/sessions/any/profile-picture', async (req: Request, res: Response) => {
    try {
      const jid = req.query.jid as string;
      if (!jid) { res.status(400).json({ error: 'jid required' }); return; }
      const url = await sm.getProfilePicture(jid);
      res.json({ url });
    } catch {
      res.json({ url: null });
    }
  });

  return router;
}

/**
 * API Key middleware — matches the Go APIKeyAuth middleware.
 */
export function apiKeyAuth(apiKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!apiKey) return next();
    const provided = req.headers['x-api-key'] as string;
    if (provided === apiKey) return next();
    res.status(401).json({ error: 'Unauthorized' });
  };
}
