'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from '@/contexts/session-context';
import type { Socket } from 'socket.io-client';

/**
 * Callback chamado ao receber eventos realtime do inbox.
 * @param event  Nome do evento ('inbox:update' | 'chat:new-message' | 'chat:message-updated')
 * @param payload Dados do evento (payload completo do servidor)
 */
export type InboxEventCallback = (event: string, payload?: any) => void;

export function useInboxWebSocket(onInboxUpdate?: InboxEventCallback) {
  const { session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const callbackRef = useRef(onInboxUpdate);
  const lastEventRef = useRef<{ key: string; ts: number }>({ key: '', ts: 0 });

  // Manter callback atualizado sem causar re-renders
  useEffect(() => {
    callbackRef.current = onInboxUpdate;
  }, [onInboxUpdate]);

  // ─── Deduplicação simples ──────────────────────────────────────────────────
  // Evita double-fire quando Socket.IO e SSE recebem o mesmo evento
  const handleEvent = useCallback((event: string, payload?: any) => {
    const key = `${event}:${payload?.conversationId || payload?.timestamp || ''}`;
    const now = Date.now();
    if (key === lastEventRef.current.key && now - lastEventRef.current.ts < 500) {
      return; // Ignorar evento duplicado dentro de 500ms
    }
    lastEventRef.current = { key, ts: now };
    callbackRef.current?.(event, payload);
  }, []);

  // ─── Conexão Socket.IO ─────────────────────────────────────────────────────
  const connectSocket = useCallback(async () => {
    if (!session?.userData?.email) return;

    try {
      const { createAuthenticatedSocket } = await import('@/lib/socket-lazy');
      const token = session.accessToken;
      if (!token) return;
      if (socketRef.current?.connected) return;

      socketRef.current = await createAuthenticatedSocket(token);

      socketRef.current.on('connect', () => {
        console.log('[InboxWS] Socket.IO connected:', socketRef.current?.id);
      });

      // inbox:update — slow-path (full refresh)
      socketRef.current.on('inbox:update', (payload: any) => {
        console.log('[InboxWS] inbox:update received via Socket.IO');
        handleEvent('inbox:update', payload);
      });

      // chat:new-message — fast-path (append direto)
      socketRef.current.on('chat:new-message', (payload: any) => {
        console.log('[InboxWS] chat:new-message received via Socket.IO', payload?.conversationId);
        handleEvent('chat:new-message', payload);
      });

      // chat:message-updated — atualização de mídia (S3 URL)
      socketRef.current.on('chat:message-updated', (payload: any) => {
        console.log('[InboxWS] chat:message-updated received via Socket.IO', payload?.messageId);
        handleEvent('chat:message-updated', payload);
      });

      socketRef.current.on('disconnect', () => {
        console.log('[InboxWS] Socket.IO disconnected');
      });

      socketRef.current.on('connect_error', (err) => {
        console.warn('[InboxWS] Socket.IO connection error (SSE fallback ativo):', err.message);
      });
    } catch (error) {
      console.error('[InboxWS] Socket.IO connection failed:', error);
    }
  }, [session, handleEvent]);

  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.off('inbox:update');
      socketRef.current.off('chat:new-message');
      socketRef.current.off('chat:message-updated');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  // ─── Conexão SSE (Fallback Universal) ─────────────────────────────────────
  // Funciona em dev:lite (next dev --turbo) e em produção
  const connectSSE = useCallback(() => {
    if (!session?.userData?.email) return;
    if (sseRef.current) return; // Já conectado

    if (typeof window === 'undefined' || !window.EventSource) return;
    try {
      const es = new EventSource('/api/v1/realtime/stream', { withCredentials: true });
      sseRef.current = es;

      es.addEventListener('connected', () => {
        console.log('[InboxWS] SSE connected (fallback ativo)');
      });

      es.addEventListener('inbox:update', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          console.log('[InboxWS] inbox:update received via SSE');
          handleEvent('inbox:update', payload);
        } catch { /* ignorar parse errors */ }
      });

      es.addEventListener('chat:new-message', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          console.log('[InboxWS] chat:new-message received via SSE', payload?.conversationId);
          handleEvent('chat:new-message', payload);
        } catch { /* ignorar */ }
      });

      es.addEventListener('chat:message-updated', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          console.log('[InboxWS] chat:message-updated received via SSE', payload?.messageId);
          handleEvent('chat:message-updated', payload);
        } catch { /* ignorar */ }
      });

      es.onerror = () => {
        // EventSource faz retry automático — apenas logamos
        console.warn('[InboxWS] SSE connection error — auto-retrying...');
      };
    } catch (error) {
      console.error('[InboxWS] SSE connection failed:', error);
    }
  }, [session, handleEvent]);

  const disconnectSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

  // ─── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;

    connectSocket();
    connectSSE(); // SSE sempre ativo como garantia

    return () => {
      disconnectSocket();
      disconnectSSE();
    };
  }, [session, connectSocket, connectSSE, disconnectSocket, disconnectSSE]);

  return {
    connected: socketRef.current?.connected ?? false,
    sseActive: typeof EventSource !== 'undefined' ? sseRef.current?.readyState === EventSource.OPEN : false,
  };
}
