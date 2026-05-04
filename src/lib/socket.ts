import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { jwtVerify } from 'jose';

let io: SocketIOServer | null = null;

// JWT Secret para validação (lido dentro das funções para evitar chaves obsoletas em HMR)

// Função para validar o token JWT
async function validateSocketToken(token: string): Promise<{ userId: string; companyId: string; email: string } | null> {
  if (!token) {
    return null;
  }

  try {
    const secret = process.env.JWT_SECRET_KEY_CALL;
    if (!secret) throw new Error('JWT_SECRET_KEY_CALL missing');
    const secretKey = new TextEncoder().encode(secret);
    console.log(`[Socket Verifier Debug] Secret Length: ${secret.length}, Prefix: ${secret.substring(0, 3)}...`);
    const { payload } = await jwtVerify(token, secretKey);

    if (!payload || !payload.userId || !payload.companyId) {
      return null;
    }

    return {
      userId: payload.userId as string,
      companyId: payload.companyId as string,
      email: payload.email as string,
    };
  } catch (error) {
    console.error('Socket auth error:', error);
    return null;
  }
}

export function initializeSocketIO(server: HTTPServer): SocketIOServer {
  if (io) {
    console.log('[Socket.IO] Reusing existing Socket.IO instance');
    return io;
  }

  // ✅ CORREÇÃO: Verificar se JWT_SECRET_KEY_CALL está definida antes de inicializar
  if (!process.env.JWT_SECRET_KEY_CALL) {
    throw new Error('JWT_SECRET_KEY_CALL não está definida nas variáveis de ambiente. Socket.IO requer autenticação.');
  }

  // Determinar origens permitidas para CORS
  const allowedOrigins = [
    '*', // TEMPORARY: Allow all origins to fix Replit connection issues
    process.env.NEXT_PUBLIC_BASE_URL || '',
    process.env.NEXT_PUBLIC_CUSTOM_DOMAIN ? `https://${process.env.NEXT_PUBLIC_CUSTOM_DOMAIN}` : '',
    'https://masteria.app',
    ...(process.env.REPLIT_DEV_DOMAIN ? [`https://${process.env.REPLIT_DEV_DOMAIN}`] : []),
    ...(process.env.REPL_SLUG && process.env.REPL_OWNER ? [`https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`] : []),
    /\.replit\.dev$/,
  ].filter(Boolean);

  // ✅ CORREÇÃO: Função de validação de origem para permitir domínios Replit dinâmicos
  const originValidator = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      return callback(null, true); // Permitir requisições sem origem (ex: mobile apps)
    }

    // Verificar se é uma das origens permitidas
    if (allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
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

  io = new SocketIOServer(server, {
    path: '/api/socketio',
    cors: {
      origin: originValidator,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Middleware de autenticação para Socket.IO
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const session = await validateSocketToken(token);

    if (!session) {
      return next(new Error('Invalid or expired token'));
    }

    // Armazenar dados da sessão no socket para uso posterior
    socket.data.userId = session.userId;
    socket.data.companyId = session.companyId;
    socket.data.email = session.email;

    next();
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id, 'Company:', socket.data.companyId);

    // Automaticamente adicionar o socket à sala da empresa
    const companyRoom = `company:${socket.data.companyId}`;
    socket.join(companyRoom);
    console.log(`Socket ${socket.id} joined room: ${companyRoom}`);

    // Eventos para reuniões
    socket.on('join_meeting', (meetingId: string) => {
      const meetingRoom = `meeting:${meetingId}`;
      socket.join(meetingRoom);
      console.log(`Socket ${socket.id} joined meeting room: ${meetingRoom}`);
    });

    socket.on('leave_meeting', (meetingId: string) => {
      const meetingRoom = `meeting:${meetingId}`;
      socket.leave(meetingRoom);
      console.log(`Socket ${socket.id} left meeting room: ${meetingRoom}`);
    });

    // NOVO: Eventos para campanhas
    socket.on('subscribe_campaign', ({ campaignId }: { campaignId: string }) => {
      const campaignRoom = `campaign:${campaignId}`;
      socket.join(campaignRoom);
      console.log(`Socket ${socket.id} subscribed to campaign: ${campaignRoom}`);
    });

    socket.on('unsubscribe_campaign', ({ campaignId }: { campaignId: string }) => {
      const campaignRoom = `campaign:${campaignId}`;
      socket.leave(campaignRoom);
      console.log(`Socket ${socket.id} unsubscribed from campaign: ${campaignRoom}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}

/**
 * Emite um evento para todos os clientes de uma empresa.
 * Usa Socket.IO em produção (custom server) e SSE como fallback em dev:lite.
 */
export function emitToCompany(companyId: string, event: string, payload?: any): void {
  const room = `company:${companyId}`;
  const eventPayload = payload || { timestamp: Date.now() };

  if (io) {
    // Produção: Socket.IO via custom server
    io.to(room).emit(event, eventPayload);
  } else {
    // Fallback 1: SSE Emitter (funciona em dev:lite e em API Routes)
    import('./sse-emitter').then(({ sseEmitter }) => {
      sseEmitter.emit(companyId, event, eventPayload);
    }).catch(err => console.error('[Socket] SSE emit error:', err.message));

    // Fallback 2: HTTP bridge (para quando o custom server está rodando em porta diferente)
    const port = process.env.PORT || '5000';
    fetch(`http://127.0.0.1:${port}/api/internal/socket-emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.JWT_SECRET_KEY_CALL,
        room,
        event,
        payload: eventPayload
      })
    }).catch(() => { /* Silencioso — esperado em dev:lite */ });
  }
}

/**
 * Alias de compatibilidade — emite 'inbox:update' para a empresa.
 * Mantido para não quebrar os callers existentes.
 */
export function emitInboxUpdate(companyId: string, payload?: any): void {
  emitToCompany(companyId, 'inbox:update', payload);
}
