"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisConnection = getRedisConnection;
exports.createRedisConnection = createRedisConnection;
exports.closeRedisConnections = closeRedisConnections;
var ioredis_1 = __importDefault(require("ioredis"));
// Singleton Redis connection for BullMQ
var redisConnection = null;
/**
 * Get or create Redis connection for BullMQ
 * This is the REAL Redis connection required for BullMQ to work properly
 */
function getRedisConnection() {
    if (!redisConnection) {
        // ✅ PERFORMANCE FIX: No Windows sem REDIS_URL, retornar mock imediatamente
        // Evita loop infinito de ECONNREFUSED que trava o event loop
        var hasRedisConfig = !!(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDISHOST);
        if (!hasRedisConfig) {
            console.warn('⚠️ [BullMQ] Sem Redis configurado. Desativando BullMQ localmente para otimizar CPU e remover lags.');
            return null;
        }
        var isBuild_1 = (process.env.NEXT_PHASE === 'phase-production-build' ||
            process.env.BUILD_PHASE === 'true' ||
            process.env.CI === 'true') && process.env.NODE_ENV !== 'production';
        if (isBuild_1 || (process.env.SKIP_REDIS_CHECK === 'true' && process.env.NODE_ENV !== 'production')) {
            console.warn('🏗️ [BullMQ] Build phase or Skip-Check detected. Desativando BullMQ.');
            return null;
        }
        var redisUrl = process.env.REDIS_URL;
        var upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
        var upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
        var railwayRedisHost = process.env.REDISHOST;
        var railwayRedisPort = process.env.REDISPORT;
        var railwayRedisPassword = process.env.REDISPASSWORD;
        // ✅ PRIORIDADE: REDIS_URL > Upstash > Railway KV > Localhost
        var connectionUrl = void 0;
        if (redisUrl) {
            connectionUrl = redisUrl;
            console.log('✅ [BullMQ] Using provided REDIS_URL');
        }
        else if (upstashUrl && upstashToken) {
            // Convert Upstash REST URL to Redis protocol (fallback)
            var upstashHost = upstashUrl.replace('https://', '').replace(/\/$/, '').split(':')[0];
            connectionUrl = "rediss://default:".concat(upstashToken, "@").concat(upstashHost, ":6379");
            console.log('✅ [BullMQ] Using Upstash Redis connection');
        }
        else if (railwayRedisHost && railwayRedisPort) {
            // Direct Railway Redis KV support
            var auth = railwayRedisPassword ? "default:".concat(railwayRedisPassword, "@") : '';
            connectionUrl = "redis://".concat(auth).concat(railwayRedisHost, ":").concat(railwayRedisPort);
            console.log('✅ [BullMQ] Using Railway Redis KV connection');
        }
        if (connectionUrl) {
            redisConnection = new ioredis_1.default(connectionUrl, {
                maxRetriesPerRequest: null, // Required for BullMQ
                enableReadyCheck: false,
                lazyConnect: true, // ✅ Prevents blocking on initialization
                retryStrategy: function (times) {
                    // No build environment, retry more aggressively
                    if (isBuild_1)
                        return null;
                    var delay = Math.min(times * 100, 3000);
                    return delay;
                }
            });
        }
        else {
            // No valid connection URL
            var isProdEnv = process.env.NODE_ENV === 'production' ||
                !!process.env.RAILWAY_ENVIRONMENT ||
                !!process.env.RAILWAY_STATIC_URL;
            if (isProdEnv && !isBuild_1 && process.env.SKIP_REDIS_CHECK !== 'true') {
                console.error('❌ [BullMQ] CRITICAL: No Redis configuration found in production environment!');
                // Don't throw anymore, return null to allow in-memory fallbacks to work
                return null;
            }
            console.warn('⚠️ [BullMQ] No Redis URL provided. BullMQ will not be available.');
            return null;
        }
        // Handle connection events
        redisConnection.on('connect', function () {
            console.log('✅ Redis connected successfully for BullMQ');
        });
        redisConnection.on('error', function (error) {
            // ✅ CORRIGIDO: Silenciar ECONNREFUSED em desenvolvimento (esperado quando Redis não está rodando)
            if (!process.env.REDIS_URL && error.code === 'ECONNREFUSED') {
                // Silenciar erro esperado - Redis não está rodando em dev
                return;
            }
            // Log outros erros apenas
            if (error.code !== 'ECONNREFUSED') {
                console.error('❌ Redis connection error:', error.message);
            }
            // Don't throw here - let BullMQ handle reconnection
        });
        redisConnection.on('close', function () {
            console.log('🔌 Redis connection closed');
        });
        redisConnection.on('reconnecting', function (delay) {
            console.log("\uD83D\uDD04 Redis reconnecting in ".concat(delay, "ms..."));
        });
    }
    return redisConnection;
}
/**
 * Create a new Redis connection for BullMQ workers
 * BullMQ requires separate connections for Queue and Worker
 */
function createRedisConnection() {
    var _this = this;
    var isBuild = (process.env.NEXT_PHASE === 'phase-production-build' ||
        process.env.SKIP_REDIS_CHECK === 'true' ||
        process.env.CI === 'true') && process.env.NODE_ENV !== 'production';
    var hasRedisConfig = !!(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDISHOST);
    if (isBuild || !hasRedisConfig) {
        if (!hasRedisConfig) {
            console.warn('⚠️ [BullMQ] Sem Redis configurado. Desativando worker do BullMQ.');
        }
        return null;
    }
    var redisUrl = process.env.REDIS_URL;
    var upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    var upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    var railwayRedisHost = process.env.REDISHOST;
    var railwayRedisPort = process.env.REDISPORT;
    var railwayRedisPassword = process.env.REDISPASSWORD;
    if (process.env.DEBUG === 'true') {
        console.log('[Redis] createRedisConnection called, REDIS_URL:', redisUrl ? 'PRESENT' : 'MISSING');
    }
    // ✅ PRIORIDADE: REDIS_URL > Upstash > Railway KV > Localhost
    var connectionUrl = redisUrl; // Initialize with redisUrl
    if (!connectionUrl && upstashUrl && upstashToken) {
        // Convert Upstash REST URL to Redis protocol (fallback)
        var upstashHost = upstashUrl.replace('https://', '').replace(/\/$/, '').split(':')[0];
        connectionUrl = "rediss://default:".concat(upstashToken, "@").concat(upstashHost, ":6379");
    }
    else if (!connectionUrl && railwayRedisHost && railwayRedisPort) {
        // Direct Railway Redis KV support
        var auth = railwayRedisPassword ? "default:".concat(railwayRedisPassword, "@") : '';
        connectionUrl = "redis://".concat(auth).concat(railwayRedisHost, ":").concat(railwayRedisPort);
    }
    if (connectionUrl) {
        // Log target host (safe version)
        try {
            var urlObj = new URL(connectionUrl);
            console.log("\u2705 [Redis] Connecting to Redis at: ".concat(urlObj.host));
        }
        catch (e) {
            console.log("\u2705 [Redis] Connecting to Redis URL (parse failed)");
        }
        return new ioredis_1.default(connectionUrl, {
            maxRetriesPerRequest: null, // Required for BullMQ
            enableReadyCheck: false,
            retryStrategy: function (times) {
                var delay = Math.min(times * 100, 3000);
                return delay;
            }
        });
    }
    // Fallback to localhost (ONLY IF NOT IN PRODUCTION)
    var isProd = process.env.NODE_ENV === 'production' ||
        !!process.env.RAILWAY_ENVIRONMENT ||
        !!process.env.RAILWAY_STATIC_URL ||
        !!process.env.VERCEL ||
        !!process.env.REDIS_URL ||
        !!process.env.REDISHOST;
    if (isProd && !connectionUrl) {
        console.error('❌ [REDIS-VERIFY-2024] CRITICAL: No Redis configuration found in production environment!');
        // Return a Proxy that absorbs all calls to prevent crashes like "incr is not a function"
        var safeMock = new Proxy({}, {
            get: function (target, prop) {
                // Essential ioredis properties/methods
                if (prop === 'on' || prop === 'once')
                    return function () { return ({}); };
                if (prop === 'quit' || prop === 'disconnect')
                    return function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/];
                    }); }); };
                if (prop === 'ping')
                    return function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, 'PONG'];
                    }); }); }; // Return PONG even if failing to keep heartbeats happy
                if (prop === 'status')
                    return 'ready'; // Pretend we're ready to avoid some retry loops
                if (prop === 'options')
                    return {};
                // Return an async function for any other property call (ioredis commands are usually async)
                return function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            console.warn("\u26A0\uFE0F [REDIS-MOCK] Method \"".concat(String(prop), "\" called but Redis is not configured."));
                            // Special case: incr should return a number
                            if (prop === 'incr' || prop === 'incrby' || prop === 'decr')
                                return [2 /*return*/, 1];
                            return [2 /*return*/, null];
                        });
                    });
                };
            }
        });
        return safeMock;
    }
    var host = process.env.REDIS_HOST || 'localhost';
    var safeHost = host === 'localhost' ? '127.0.0.1' : host;
    console.error("\uD83D\uDCE1 [REDIS-VERIFY-2024] Falling back to local Redis at ".concat(safeHost, ":6379"));
    try {
        return new ioredis_1.default({
            host: safeHost,
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            maxRetriesPerRequest: null, // Required for BullMQ
            enableReadyCheck: false,
            connectTimeout: 2000,
            family: 4, // Force IPv4
            retryStrategy: function (times) {
                // Stop retrying after 3 attempts in production for localhost fallback
                if (isProd && times > 3)
                    return null;
                var delay = Math.min(times * 50, 2000);
                return delay;
            }
        });
    }
    catch (e) {
        console.error('❌ [REDIS-VERIFY-2024] Failed to create fallback Redis client');
        return null;
    }
}
/**
 * Close Redis connections gracefully
 */
function closeRedisConnections() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!redisConnection) return [3 /*break*/, 2];
                    return [4 /*yield*/, redisConnection.quit()];
                case 1:
                    _a.sent();
                    redisConnection = null;
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    });
}
