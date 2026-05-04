/**
 * SSE Stream Endpoint — /api/v1/realtime/stream
 *
 * Fornece eventos em tempo real via Server-Sent Events (SSE).
 * Funciona como fallback universal quando o Socket.IO não está disponível
 * (ex: `next dev --turbo` / `dev:lite`).
 *
 * Em produção, este endpoint coexiste com o Socket.IO — o cliente
 * usa o que estiver disponível primeiro.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithUserOr401 } from '@/lib/api-auth-helper';
import { sseEmitter } from '@/lib/sse-emitter';

// SSE streams precisam ser dinâmicos — nunca cacheados
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Autenticar via sessão (cookies automáticos com EventSource)
  const authResult = await requireAuthWithUserOr401();
  if (authResult instanceof NextResponse) return authResult;

  const { companyId } = authResult;
  const encoder = new TextEncoder();

  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;

      // Registrar cliente no emitter
      sseEmitter.addClient(companyId, controller);

      // Enviar evento inicial de conexão estabelecida
      controller.enqueue(encoder.encode('event: connected\ndata: {"status":"ok"}\n\n'));

      // Keepalive a cada 25s para manter a conexão viva (proxies fecham após 30s idle)
      keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          // Controller fechado — parar timer
          if (keepAliveTimer) clearInterval(keepAliveTimer);
        }
      }, 25_000);

      // Limpar recursos quando o cliente desconectar
      request.signal.addEventListener('abort', () => {
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        if (controllerRef) {
          sseEmitter.removeClient(companyId, controllerRef);
          controllerRef = null;
        }
        try {
          controller.close();
        } catch {
          // Já fechado
        }
      });
    },

    cancel() {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      if (controllerRef) {
        sseEmitter.removeClient(companyId, controllerRef);
        controllerRef = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Desativa buffering do Nginx/Railway
      'Access-Control-Allow-Origin': '*',
    },
  });
}
