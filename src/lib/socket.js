"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocketIO = initializeSocketIO;
exports.getSocketIO = getSocketIO;
exports.emitToCompany = emitToCompany;
exports.emitInboxUpdate = emitInboxUpdate;
var socket_io_1 = require("socket.io");
var jose_1 = require("jose");
var io = null;
// JWT Secret para validação (lido dentro das funções para evitar chaves obsoletas em HMR)
// Função para validar o token JWT
function validateSocketToken(token) {
    return __awaiter(this, void 0, void 0, function () {
        var secret, secretKey, payload, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!token) {
                        return [2 /*return*/, null];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    secret = process.env.JWT_SECRET_KEY_CALL;
                    if (!secret)
                        throw new Error('JWT_SECRET_KEY_CALL missing');
                    secretKey = new TextEncoder().encode(secret);
                    console.log("[Socket Verifier Debug] Secret Length: ".concat(secret.length, ", Prefix: ").concat(secret.substring(0, 3), "..."));
                    return [4 /*yield*/, (0, jose_1.jwtVerify)(token, secretKey)];
                case 2:
                    payload = (_a.sent()).payload;
                    if (!payload || !payload.userId || !payload.companyId) {
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, {
                            userId: payload.userId,
                            companyId: payload.companyId,
                            email: payload.email,
                        }];
                case 3:
                    error_1 = _a.sent();
                    console.error('Socket auth error:', error_1);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function initializeSocketIO(server) {
    var _this = this;
    if (io) {
        console.log('[Socket.IO] Reusing existing Socket.IO instance');
        return io;
    }
    // ✅ CORREÇÃO: Usar fallback no build para não quebrar a compilação
    var secret = process.env.JWT_SECRET_KEY_CALL || 'dummy_secret_key';
    // Determinar origens permitidas para CORS
    var allowedOrigins = __spreadArray(__spreadArray(__spreadArray([
        '*', // TEMPORARY: Allow all origins to fix Replit connection issues
        process.env.NEXT_PUBLIC_BASE_URL || '',
        process.env.NEXT_PUBLIC_CUSTOM_DOMAIN ? "https://".concat(process.env.NEXT_PUBLIC_CUSTOM_DOMAIN) : '',
        'https://masteria-temporario.up.railway.app'
    ], (process.env.REPLIT_DEV_DOMAIN ? ["https://".concat(process.env.REPLIT_DEV_DOMAIN)] : []), true), (process.env.REPL_SLUG && process.env.REPL_OWNER ? ["https://".concat(process.env.REPL_SLUG, ".").concat(process.env.REPL_OWNER, ".repl.co")] : []), true), [
        /\.replit\.dev$/,
    ], false).filter(Boolean);
    // ✅ CORREÇÃO: Função de validação de origem para permitir domínios Replit dinâmicos
    var originValidator = function (origin, callback) {
        if (!origin) {
            return callback(null, true); // Permitir requisições sem origem (ex: mobile apps)
        }
        // Verificar se é uma das origens permitidas
        if (allowedOrigins.some(function (allowed) {
            if (typeof allowed === 'string') {
                return origin === allowed;
            }
            else if (allowed instanceof RegExp) {
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
    io = new socket_io_1.Server(server, {
        path: '/api/socketio',
        cors: {
            origin: originValidator,
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });
    // Middleware de autenticação para Socket.IO
    io.use(function (socket, next) { return __awaiter(_this, void 0, void 0, function () {
        var token, session;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    token = ((_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.token) || ((_c = (_b = socket.handshake.headers) === null || _b === void 0 ? void 0 : _b.authorization) === null || _c === void 0 ? void 0 : _c.replace('Bearer ', ''));
                    if (!token) {
                        return [2 /*return*/, next(new Error('Authentication required'))];
                    }
                    return [4 /*yield*/, validateSocketToken(token)];
                case 1:
                    session = _d.sent();
                    if (!session) {
                        return [2 /*return*/, next(new Error('Invalid or expired token'))];
                    }
                    // Armazenar dados da sessão no socket para uso posterior
                    socket.data.userId = session.userId;
                    socket.data.companyId = session.companyId;
                    socket.data.email = session.email;
                    next();
                    return [2 /*return*/];
            }
        });
    }); });
    io.on('connection', function (socket) {
        console.log('Client connected:', socket.id, 'Company:', socket.data.companyId);
        // Automaticamente adicionar o socket à sala da empresa
        var companyRoom = "company:".concat(socket.data.companyId);
        socket.join(companyRoom);
        console.log("Socket ".concat(socket.id, " joined room: ").concat(companyRoom));
        // Eventos para reuniões
        socket.on('join_meeting', function (meetingId) {
            var meetingRoom = "meeting:".concat(meetingId);
            socket.join(meetingRoom);
            console.log("Socket ".concat(socket.id, " joined meeting room: ").concat(meetingRoom));
        });
        socket.on('leave_meeting', function (meetingId) {
            var meetingRoom = "meeting:".concat(meetingId);
            socket.leave(meetingRoom);
            console.log("Socket ".concat(socket.id, " left meeting room: ").concat(meetingRoom));
        });
        // NOVO: Eventos para campanhas
        socket.on('subscribe_campaign', function (_a) {
            var campaignId = _a.campaignId;
            var campaignRoom = "campaign:".concat(campaignId);
            socket.join(campaignRoom);
            console.log("Socket ".concat(socket.id, " subscribed to campaign: ").concat(campaignRoom));
        });
        socket.on('unsubscribe_campaign', function (_a) {
            var campaignId = _a.campaignId;
            var campaignRoom = "campaign:".concat(campaignId);
            socket.leave(campaignRoom);
            console.log("Socket ".concat(socket.id, " unsubscribed from campaign: ").concat(campaignRoom));
        });
        socket.on('disconnect', function () {
            console.log('Client disconnected:', socket.id);
        });
    });
    return io;
}
function getSocketIO() {
    return io;
}
/**
 * Emite um evento para todos os clientes de uma empresa.
 * Usa Socket.IO em produção (custom server) e SSE como fallback em dev:lite.
 */
function emitToCompany(companyId, event, payload) {
    var room = "company:".concat(companyId);
    var eventPayload = payload || { timestamp: Date.now() };
    if (io) {
        // Produção: Socket.IO via custom server
        io.to(room).emit(event, eventPayload);
    }
    else {
        // Fallback 1: SSE Emitter (funciona em dev:lite e em API Routes)
        Promise.resolve().then(function () { return __importStar(require('./sse-emitter')); }).then(function (_a) {
            var sseEmitter = _a.sseEmitter;
            sseEmitter.emit(companyId, event, eventPayload);
        }).catch(function (err) { return console.error('[Socket] SSE emit error:', err.message); });
        // Fallback 2: HTTP bridge (para quando o custom server está rodando em porta diferente)
        var port = process.env.PORT || '5000';
        fetch("http://127.0.0.1:".concat(port, "/api/internal/socket-emit"), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: process.env.JWT_SECRET_KEY_CALL,
                room: room,
                event: event,
                payload: eventPayload
            })
        }).catch(function () { });
    }
}
/**
 * Alias de compatibilidade — emite 'inbox:update' para a empresa.
 * Mantido para não quebrar os callers existentes.
 */
function emitInboxUpdate(companyId, payload) {
    emitToCompany(companyId, 'inbox:update', payload);
}
