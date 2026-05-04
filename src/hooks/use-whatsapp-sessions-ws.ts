'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from '@/contexts/session-context';
import type { Socket } from 'socket.io-client';
import useSWR from 'swr';
import { useToast } from './use-toast';

export interface BaileysSession {
  id: string;
  name: string;
  status: string;
  phone?: string;
  lastConnected?: Date;
  isActive: boolean;
  createdAt?: Date;
  hasAuth?: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Hook para gerenciar sessões WhatsApp com WebSocket em tempo real
 * Substitui polling por atualizações push via WebSocket
 */
export function useWhatsAppSessionsWS() {
  const { toast } = useToast();
  const { session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  // ✅ CORREÇÃO: Cache para deduplicação de eventos de status
  const lastStatusUpdateRef = useRef<Map<string, { status: string; timestamp: string }>>(new Map());
  // ✅ CORREÇÃO: Cache para deduplicação de eventos de criação/deleção
  const lastEventRef = useRef<Map<string, { type: 'created' | 'deleted'; timestamp: number }>>(new Map());
  // ✅ CORREÇÃO: Flag para evitar múltiplas conexões simultâneas
  const isConnectingRef = useRef<boolean>(false);
  
  // ✅ FASE 1.1: Carregar dados iniciais apenas uma vez (sem polling)
  const { data, error, mutate, isLoading } = useSWR<{ sessions: BaileysSession[] }>(
    '/api/v1/whatsapp/sessions',
    fetcher,
    {
      refreshInterval: 0, // ✅ Desabilitar polling - WebSocket substitui
      revalidateOnFocus: false, // ✅ Não revalidar ao focar - WebSocket mantém atualizado
      revalidateOnReconnect: true, // ✅ Revalidar apenas em reconexão de rede
    }
  );

  const connect = useCallback(async () => {
    if (!session?.userData?.email) return;

    // ✅ CORREÇÃO: Prevenir múltiplas conexões simultâneas
    if (isConnectingRef.current) {
      console.log('[WhatsAppSessionsWS] Connection already in progress, skipping...');
      return;
    }

    // ✅ CORREÇÃO: Desconectar socket existente antes de criar novo (prevenir múltiplos listeners)
    if (socketRef.current) {
      console.log('[WhatsAppSessionsWS] Disconnecting existing socket before reconnecting...');
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    isConnectingRef.current = true;

    try {
      const { createAuthenticatedSocket } = await import('@/lib/socket-lazy');
      const token = session.accessToken;

      if (!token) return;

      socketRef.current = await createAuthenticatedSocket(token);

      socketRef.current.on('connect', () => {
        console.log('[WhatsAppSessionsWS] ✅ Connected:', socketRef.current?.id);
        isConnectingRef.current = false;
      });

      // ✅ FASE 1.1: Escutar eventos de sessão em tempo real
      socketRef.current.on('whatsapp:session:created', (session: BaileysSession) => {
        // ✅ CORREÇÃO: Deduplicação de eventos de criação
        const eventKey = `created:${session.id}`;
        const lastEvent = lastEventRef.current.get(eventKey);
        const now = Date.now();
        
        if (lastEvent && lastEvent.type === 'created' && (now - lastEvent.timestamp) < 2000) {
          console.log('[WhatsAppSessionsWS] Duplicate session:created event ignored:', session.id);
          return;
        }
        
        lastEventRef.current.set(eventKey, { type: 'created', timestamp: now });
        
        // Limpar cache antigo (mais de 10 segundos)
        setTimeout(() => {
          lastEventRef.current.delete(eventKey);
        }, 10000);
        
        console.log('[WhatsAppSessionsWS] Session created:', session);
        mutate((current) => {
          if (!current) return { sessions: [session] };
          
          // ✅ CORREÇÃO: Verificar se sessão já existe antes de adicionar (prevenir duplicatas)
          const existingIndex = current.sessions.findIndex(s => s.id === session.id);
          if (existingIndex >= 0) {
            // Sessão já existe, atualizar ao invés de adicionar
            return {
              sessions: current.sessions.map((s, idx) => 
                idx === existingIndex ? { ...s, ...session } : s
              ),
            };
          }
          
          return {
            sessions: [...current.sessions, session],
          };
        }, false); // Não revalidar, apenas atualizar cache
      });

      socketRef.current.on('whatsapp:session:updated', (session: BaileysSession) => {
        console.log('[WhatsAppSessionsWS] Session updated:', session);
        mutate((current) => {
          if (!current) return { sessions: [session] };
          return {
            sessions: current.sessions.map((s) =>
              s.id === session.id ? { ...s, ...session } : s
            ),
          };
        }, false); // Não revalidar, apenas atualizar cache
      });

      socketRef.current.on('whatsapp:session:deleted', ({ id }: { id: string }) => {
        // ✅ CORREÇÃO: Deduplicação de eventos de deleção
        const eventKey = `deleted:${id}`;
        const lastEvent = lastEventRef.current.get(eventKey);
        const now = Date.now();
        
        if (lastEvent && lastEvent.type === 'deleted' && (now - lastEvent.timestamp) < 2000) {
          console.log('[WhatsAppSessionsWS] Duplicate session:deleted event ignored:', id);
          return;
        }
        
        lastEventRef.current.set(eventKey, { type: 'deleted', timestamp: now });
        
        // Limpar cache antigo (mais de 10 segundos)
        setTimeout(() => {
          lastEventRef.current.delete(eventKey);
        }, 10000);
        
        console.log('[WhatsAppSessionsWS] Session deleted:', id);
        mutate((current) => {
          if (!current) return { sessions: [] };
          return {
            sessions: current.sessions.filter((s) => s.id !== id),
          };
        }, false); // Não revalidar, apenas atualizar cache
      });

      socketRef.current.on('whatsapp:session:status', (data: {
        sessionId: string;
        status: string;
        phone?: string;
        timestamp: string;
      }) => {
        // ✅ CORREÇÃO: Deduplicação de eventos - verificar se este evento já foi processado
        const lastUpdate = lastStatusUpdateRef.current.get(data.sessionId);
        if (lastUpdate && 
            lastUpdate.status === data.status && 
            lastUpdate.timestamp === data.timestamp) {
          // Evento duplicado, ignorar silenciosamente
          return;
        }
        
        // Atualizar cache de último evento processado
        lastStatusUpdateRef.current.set(data.sessionId, {
          status: data.status,
          timestamp: data.timestamp,
        });
        
        console.log('[WhatsAppSessionsWS] Status changed:', data);
        mutate((current) => {
          if (!current) return { sessions: [] };
          return {
            sessions: current.sessions.map((s) =>
              s.id === data.sessionId
                ? { ...s, status: data.status, phone: data.phone }
                : s
            ),
          };
        }, false);
      });

      socketRef.current.on('whatsapp:session:qr', (data: {
        sessionId: string;
        qr: string;
      }) => {
        console.log('[WhatsAppSessionsWS] QR code updated:', data.sessionId);
        // QR code é gerenciado pelo QRCodeModal via SSE, mas podemos atualizar status aqui
        mutate((current) => {
          if (!current) return { sessions: [] };
          return {
            sessions: current.sessions.map((s) =>
              s.id === data.sessionId ? { ...s, status: 'qr' } : s
            ),
          };
        }, false);
      });

      socketRef.current.on('disconnect', () => {
        console.log('[WhatsAppSessionsWS] Disconnected');
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('[WhatsAppSessionsWS] Connection error:', error);
        isConnectingRef.current = false;
      });
    } catch (error) {
      console.error('[WhatsAppSessionsWS] Connection failed:', error);
      isConnectingRef.current = false;
    }
  }, [session, mutate]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (session) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [session, connect, disconnect]);

  // Funções de ação (mantidas do hook original)
  const createSession = async (name: string) => {
    try {
      const res = await fetch('/api/v1/whatsapp/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create session');
      }

      const result = await res.json();
      // ✅ WebSocket emitirá evento automaticamente, mas revalidamos para garantir
      mutate();

      toast({
        title: 'Sessão criada',
        description: 'Escaneie o QR Code para conectar',
      });

      return result.session;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: (error as Error).message,
      });
      return null;
    }
  };

  const deleteSession = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/whatsapp/sessions/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete session');
      }

      // ✅ WebSocket emitirá evento automaticamente, mas revalidamos para garantir
      mutate();

      toast({
        title: 'Sessão deletada',
        description: 'A sessão foi removida com sucesso',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: (error as Error).message,
      });
    }
  };

  const reconnectSession = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/whatsapp/sessions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reconnect' }),
      });

      if (!res.ok) {
        throw new Error('Failed to reconnect session');
      }

      mutate();

      toast({
        title: 'Reconectando',
        description: 'A sessão está sendo reconectada',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: (error as Error).message,
      });
    }
  };

  const resumeSession = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/whatsapp/sessions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to resume session');
      }

      mutate();

      toast({
        title: 'Recuperando sessão',
        description: 'Tentando restaurar conexão com credenciais salvas...',
      });

      return true;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao recuperar',
        description: (error as Error).message,
      });
      return false;
    }
  };

  // ✅ CORREÇÃO: Garantir que o array de sessões seja sempre único (por ID)
  // Usar Map para garantir unicidade e preservar ordem
  const uniqueSessionsMap = new Map<string, BaileysSession>();
  (data?.sessions || []).forEach(session => {
    if (!uniqueSessionsMap.has(session.id)) {
      uniqueSessionsMap.set(session.id, session);
    }
  });
  const uniqueSessions = Array.from(uniqueSessionsMap.values());

  return {
    sessions: uniqueSessions,
    isLoading,
    error,
    createSession,
    deleteSession,
    reconnectSession,
    resumeSession,
    mutate,
    connected: socketRef.current?.connected ?? false,
  };
}
