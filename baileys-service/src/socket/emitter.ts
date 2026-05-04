/**
 * Socket.IO Event Emitter — Real Socket.IO (not WebSocket hack).
 * Emits events to company rooms, matching the contract expected by
 * baileys-ws-listener.ts in the Next.js app.
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';

let io: SocketIOServer | null = null;

// Deduplication caches
const lastQREmit = new Map<string, { value: string; ts: number }>();
const lastStatusEmit = new Map<string, { value: string; ts: number }>();
const lastSessionEvt = new Map<string, { value: string; ts: number }>();

/**
 * Initialize the Socket.IO server on the given HTTP server.
 * Path is /baileys-ws (matching what baileys-ws-listener.ts connects to).
 */
export function initSocketIO(server: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(server, {
    path: '/baileys-ws',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.on('connection', (socket) => {
    logger.info({ clientId: socket.id }, '[WS] Client connected');

    // Handle room joins (company:X)
    socket.on('join:company', (companyId: string) => {
      const room = `company:${companyId}`;
      socket.join(room);
      logger.info({ clientId: socket.id, room }, '[WS] Client joined room');
    });

    socket.on('disconnect', () => {
      logger.info({ clientId: socket.id }, '[WS] Client disconnected');
    });
  });

  // Periodic cache cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of lastQREmit) if (now - v.ts > 30000) lastQREmit.delete(k);
    for (const [k, v] of lastStatusEmit) if (now - v.ts > 10000) lastStatusEmit.delete(k);
    for (const [k, v] of lastSessionEvt) if (now - v.ts > 10000) lastSessionEvt.delete(k);
  }, 60000);

  logger.info('✅ Socket.IO initialized on path /baileys-ws');
  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

// --- Emission helpers with deduplication ---

function emitToRoom(room: string, event: string, data: any): void {
  if (!io) return;
  io.to(room).emit(event, data);
  // Emit locally/globally to all connected clients (the bridge)
  // Since the only clients connecting to this WS are the backend bridge instances, this is safe and necessary.
  io.emit(event, data);
}

export function emitSessionCreated(companyId: string, data: any): void {
  const key = `${companyId}:created`;
  const now = Date.now();
  const last = lastSessionEvt.get(key);
  if (last && now - last.ts < 2000) return;
  lastSessionEvt.set(key, { value: 'created', ts: now });

  emitToRoom(`company:${companyId}`, 'whatsapp:session:created', data);
}

export function emitSessionUpdated(companyId: string, data: any): void {
  emitToRoom(`company:${companyId}`, 'whatsapp:session:updated', data);
}

export function emitSessionDeleted(companyId: string, sessionId: string): void {
  const key = `${companyId}:${sessionId}:deleted`;
  const now = Date.now();
  const last = lastSessionEvt.get(key);
  if (last && now - last.ts < 2000) return;
  lastSessionEvt.set(key, { value: 'deleted', ts: now });

  emitToRoom(`company:${companyId}`, 'whatsapp:session:deleted', { id: sessionId });
}

export function emitQRCodeUpdated(companyId: string, sessionId: string, qr: string): void {
  const key = `${companyId}:${sessionId}:qr`;
  const now = Date.now();
  const last = lastQREmit.get(key);
  if (last && last.value === qr && now - last.ts < 5000) return;
  lastQREmit.set(key, { value: qr, ts: now });

  emitToRoom(`company:${companyId}`, 'whatsapp:session:qr', { sessionId, qr });
}

export function emitConnectionStatusChanged(
  companyId: string,
  sessionId: string,
  status: string,
  phone?: string
): void {
  const key = `${companyId}:${sessionId}:${status}`;
  const now = Date.now();
  const last = lastStatusEmit.get(key);
  if (last && last.value === status && now - last.ts < 2000) return;
  lastStatusEmit.set(key, { value: status, ts: now });

  const payload: Record<string, string> = {
    sessionId,
    status,
    timestamp: new Date().toISOString(),
  };
  if (phone) payload.phone = phone;

  emitToRoom(`company:${companyId}`, 'whatsapp:session:status', payload);
}

export function emitIncomingMessage(companyId: string, data: any): void {
  emitToRoom(`company:${companyId}`, 'baileys:incoming-message', data);
}
