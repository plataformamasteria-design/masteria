/**
 * SSE (Server-Sent Events) Emitter
 * Funciona como fallback universal do Socket.IO quando o servidor customizado
 * (src/server.ts) não está ativo — ex: modo `next dev --turbo` (dev:lite).
 *
 * Usa um singleton global para persistir os clientes conectados entre
 * as requisições e sobreviver ao HMR do Next.js em desenvolvimento.
 */

type SSEController = ReadableStreamDefaultController<Uint8Array>;

class SSEEmitterStore {
  private clients: Map<string, Set<SSEController>> = new Map();
  private readonly encoder = new TextEncoder();

  addClient(companyId: string, controller: SSEController): void {
    if (!this.clients.has(companyId)) {
      this.clients.set(companyId, new Set());
    }
    this.clients.get(companyId)!.add(controller);
    console.log(`[SSE] ✅ Client connected for company ${companyId}. Total: ${this.getClientCount(companyId)}`);
  }

  removeClient(companyId: string, controller: SSEController): void {
    const company = this.clients.get(companyId);
    if (!company) return;
    company.delete(controller);
    if (company.size === 0) {
      this.clients.delete(companyId);
    }
    console.log(`[SSE] Client disconnected for company ${companyId}. Remaining: ${this.getClientCount(companyId)}`);
  }

  emit(companyId: string, event: string, data: unknown): void {
    const clients = this.clients.get(companyId);
    if (!clients || clients.size === 0) return;

    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoded = this.encoder.encode(message);

    const deadClients: SSEController[] = [];
    for (const controller of clients) {
      try {
        controller.enqueue(encoded);
      } catch {
        // Client disconnected — mark for removal
        deadClients.push(controller);
      }
    }

    // Cleanup dead clients
    for (const dead of deadClients) {
      clients.delete(dead);
    }
    if (clients.size === 0) {
      this.clients.delete(companyId);
    }
  }

  getClientCount(companyId: string): number {
    return this.clients.get(companyId)?.size ?? 0;
  }

  getTotalClients(): number {
    let total = 0;
    for (const set of this.clients.values()) total += set.size;
    return total;
  }
}

// ─── Global Singleton ────────────────────────────────────────────────────────
// Usar `global` garante que a mesma instância persiste entre HMR reloads
// no modo de desenvolvimento do Next.js.
declare global {
  // eslint-disable-next-line no-var
  var __sseEmitterStore: SSEEmitterStore | undefined;
}

if (!global.__sseEmitterStore) {
  global.__sseEmitterStore = new SSEEmitterStore();
}

export const sseEmitter: SSEEmitterStore = global.__sseEmitterStore;
