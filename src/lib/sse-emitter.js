"use strict";
/**
 * SSE (Server-Sent Events) Emitter
 * Funciona como fallback universal do Socket.IO quando o servidor customizado
 * (src/server.ts) não está ativo — ex: modo `next dev --turbo` (dev:lite).
 *
 * Usa um singleton global para persistir os clientes conectados entre
 * as requisições e sobreviver ao HMR do Next.js em desenvolvimento.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sseEmitter = void 0;
var SSEEmitterStore = /** @class */ (function () {
    function SSEEmitterStore() {
        this.clients = new Map();
        this.encoder = new TextEncoder();
    }
    SSEEmitterStore.prototype.addClient = function (companyId, controller) {
        if (!this.clients.has(companyId)) {
            this.clients.set(companyId, new Set());
        }
        this.clients.get(companyId).add(controller);
        console.log("[SSE] \u2705 Client connected for company ".concat(companyId, ". Total: ").concat(this.getClientCount(companyId)));
    };
    SSEEmitterStore.prototype.removeClient = function (companyId, controller) {
        var company = this.clients.get(companyId);
        if (!company)
            return;
        company.delete(controller);
        if (company.size === 0) {
            this.clients.delete(companyId);
        }
        console.log("[SSE] Client disconnected for company ".concat(companyId, ". Remaining: ").concat(this.getClientCount(companyId)));
    };
    SSEEmitterStore.prototype.emit = function (companyId, event, data) {
        var clients = this.clients.get(companyId);
        if (!clients || clients.size === 0)
            return;
        var message = "event: ".concat(event, "\ndata: ").concat(JSON.stringify(data), "\n\n");
        var encoded = this.encoder.encode(message);
        var deadClients = [];
        for (var _i = 0, clients_1 = clients; _i < clients_1.length; _i++) {
            var controller = clients_1[_i];
            try {
                controller.enqueue(encoded);
            }
            catch (_a) {
                // Client disconnected — mark for removal
                deadClients.push(controller);
            }
        }
        // Cleanup dead clients
        for (var _b = 0, deadClients_1 = deadClients; _b < deadClients_1.length; _b++) {
            var dead = deadClients_1[_b];
            clients.delete(dead);
        }
        if (clients.size === 0) {
            this.clients.delete(companyId);
        }
    };
    SSEEmitterStore.prototype.getClientCount = function (companyId) {
        var _a, _b;
        return (_b = (_a = this.clients.get(companyId)) === null || _a === void 0 ? void 0 : _a.size) !== null && _b !== void 0 ? _b : 0;
    };
    SSEEmitterStore.prototype.getTotalClients = function () {
        var total = 0;
        for (var _i = 0, _a = this.clients.values(); _i < _a.length; _i++) {
            var set = _a[_i];
            total += set.size;
        }
        return total;
    };
    return SSEEmitterStore;
}());
if (!global.__sseEmitterStore) {
    global.__sseEmitterStore = new SSEEmitterStore();
}
exports.sseEmitter = global.__sseEmitterStore;
