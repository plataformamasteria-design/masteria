// src/lib/socket-lazy.ts
// Dynamic import wrapper para Socket.IO-client - reduz bundle inicial em ~1.6MB

import type { Socket, ManagerOptions, SocketOptions } from 'socket.io-client';
import { getBaseUrl } from '@/utils/get-base-url';

/**
 * Cria e retorna uma instância do Socket.IO com lazy loading
 * @param opts Opções para configuração do socket
 * @returns Promise<Socket>
 */
export async function createSocket(opts?: Partial<ManagerOptions & SocketOptions>): Promise<Socket> {
  const { io } = await import('socket.io-client');
  return io(opts);
}

/**
 * Helper para inicializar socket com autenticação
 * @param token Token de autenticação
 * @param additionalOpts Opções adicionais
 * @returns Promise<Socket>
 */
export async function createAuthenticatedSocket(
  token: string,
  additionalOpts?: Partial<ManagerOptions & SocketOptions>
): Promise<Socket> {
  const { io } = await import('socket.io-client');
  
  // Usar getBaseUrl() para garantir URL correta em todos os ambientes
  const baseUrl = getBaseUrl();
  
  console.log('[SocketIO Client] Connecting to:', baseUrl, 'path: /api/socketio');
  
  // ✅ CORREÇÃO: Se estiver no navegador e a URL for um domínio Replit dinâmico, usar window.location.origin
  const socketUrl = typeof window !== 'undefined' && window.location.origin.includes('replit.dev')
    ? window.location.origin
    : baseUrl;
  
  console.log('[SocketIO Client] Final socket URL:', socketUrl);
  
  return io(socketUrl, {
    path: '/api/socketio',
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000, // ✅ Aumentar timeout para 20s
    ...additionalOpts,
  });
}
