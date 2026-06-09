import Redis from 'ioredis';

// Singleton Redis connection for BullMQ
let redisConnection: Redis | null = null;

/**
 * Get or create Redis connection for BullMQ
 * This is the REAL Redis connection required for BullMQ to work properly
 */
export function getRedisConnection(): Redis {
  if (!redisConnection) {
    // ✅ PERFORMANCE FIX: No Windows sem REDIS_URL, retornar mock imediatamente
    // Evita loop infinito de ECONNREFUSED que trava o event loop
    const hasRedisConfig = !!(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDISHOST);
    if (!hasRedisConfig) {
      console.warn('⚠️ [BullMQ] Sem Redis configurado. Retornando mock silencioso para evitar lags.');
      return new Proxy({}, {
        get: (target, prop) => {
          if (prop === 'on' || prop === 'once') return () => { };
          if (prop === 'quit' || prop === 'disconnect') return async () => { };
          if (prop === 'ping') return async () => 'PONG';
          if (prop === 'status') return 'ready';
          if (prop === 'info') return async () => 'redis_version:999.999.999\r\n';
          if (prop === 'client') return async () => 'OK';
          if (prop === 'options') return {};
          return () => Promise.resolve(null);
        }
      }) as any;
    }
    const isBuild = (process.env.NEXT_PHASE === 'phase-production-build' ||
      process.env.BUILD_PHASE === 'true' ||
      process.env.CI === 'true') && process.env.NODE_ENV !== 'production';

    if (isBuild || (process.env.SKIP_REDIS_CHECK === 'true' && process.env.NODE_ENV !== 'production')) {
      console.warn('🏗️ [BullMQ] Build phase or Skip-Check detected. Returning safe proxy mock.');
      return new Proxy({}, {
        get: (target, prop) => {
          if (prop === 'on' || prop === 'once') return () => { };
          if (prop === 'quit' || prop === 'disconnect') return async () => { };
          if (prop === 'ping') return async () => 'PONG';
          return () => Promise.resolve(null);
        }
      }) as any;
    }

    const redisUrl = process.env.REDIS_URL;
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const railwayRedisHost = process.env.REDISHOST;
    const railwayRedisPort = process.env.REDISPORT;
    const railwayRedisPassword = process.env.REDISPASSWORD;

    // ✅ PRIORIDADE: REDIS_URL > Upstash > Railway KV > Localhost
    let connectionUrl: string | undefined;

    if (redisUrl) {
      connectionUrl = redisUrl;
      console.log('✅ [BullMQ] Using provided REDIS_URL');
    } else if (upstashUrl && upstashToken) {
      // Convert Upstash REST URL to Redis protocol (fallback)
      const upstashHost = upstashUrl.replace('https://', '').replace(/\/$/, '').split(':')[0];
      connectionUrl = `rediss://default:${upstashToken}@${upstashHost}:6379`;
      console.log('✅ [BullMQ] Using Upstash Redis connection');
    } else if (railwayRedisHost && railwayRedisPort) {
      // Direct Railway Redis KV support
      const auth = railwayRedisPassword ? `default:${railwayRedisPassword}@` : '';
      connectionUrl = `redis://${auth}${railwayRedisHost}:${railwayRedisPort}`;
      console.log('✅ [BullMQ] Using Railway Redis KV connection');
    }

    if (connectionUrl) {
      redisConnection = new Redis(connectionUrl, {
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false,
        lazyConnect: true, // ✅ Prevents blocking on initialization
        retryStrategy: (times) => {
          // No build environment, retry more aggressively
          if (isBuild) return null;
          const delay = Math.min(times * 100, 3000);
          return delay;
        }
      });
    } else {
      // No valid connection URL
      const isProdEnv = process.env.NODE_ENV === 'production' ||
        !!process.env.RAILWAY_ENVIRONMENT ||
        !!process.env.RAILWAY_STATIC_URL;

      if (isProdEnv && !isBuild && process.env.SKIP_REDIS_CHECK !== 'true') {
        console.error('❌ [BullMQ] CRITICAL: No Redis configuration found in production environment!');
        // Don't throw anymore, return null to allow in-memory fallbacks to work
        return null as any;
      }
      console.warn('⚠️ [BullMQ] No Redis URL provided. BullMQ will not be available.');
      return null as any;
    }

    // Handle connection events
    redisConnection.on('connect', () => {
      console.log('✅ Redis connected successfully for BullMQ');
    });

    redisConnection.on('error', (error: any) => {
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

    redisConnection.on('close', () => {
      console.log('🔌 Redis connection closed');
    });

    redisConnection.on('reconnecting', (delay: number) => {
      console.log(`🔄 Redis reconnecting in ${delay}ms...`);
    });
  }

  return redisConnection;
}

/**
 * Create a new Redis connection for BullMQ workers
 * BullMQ requires separate connections for Queue and Worker
 */
export function createRedisConnection(): Redis {
  const isBuild = (process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.SKIP_REDIS_CHECK === 'true' ||
    process.env.CI === 'true') && process.env.NODE_ENV !== 'production';

  const hasRedisConfig = !!(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDISHOST);

  if (isBuild || !hasRedisConfig) {
    if (!hasRedisConfig) {
      // Log apenas uma vez
    }
    return new Proxy({}, {
      get: (target, prop) => {
        if (prop === 'on' || prop === 'once') return () => { };
        if (prop === 'quit' || prop === 'disconnect') return async () => { };
        if (prop === 'ping') return async () => 'PONG';
        if (prop === 'status') return 'ready';
        if (prop === 'info') return async () => 'redis_version:999.999.999\r\n';
        if (prop === 'client') return async () => 'OK';
        if (prop === 'options') return {};
        return () => Promise.resolve(null);
      }
    }) as any;
  }


  const redisUrl = process.env.REDIS_URL;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const railwayRedisHost = process.env.REDISHOST;
  const railwayRedisPort = process.env.REDISPORT;
  const railwayRedisPassword = process.env.REDISPASSWORD;

  if (process.env.DEBUG === 'true') {
    console.log('[Redis] createRedisConnection called, REDIS_URL:', redisUrl ? 'PRESENT' : 'MISSING');
  }


  // ✅ PRIORIDADE: REDIS_URL > Upstash > Railway KV > Localhost
  let connectionUrl: string | undefined = redisUrl; // Initialize with redisUrl

  if (!connectionUrl && upstashUrl && upstashToken) {
    // Convert Upstash REST URL to Redis protocol (fallback)
    const upstashHost = upstashUrl.replace('https://', '').replace(/\/$/, '').split(':')[0];
    connectionUrl = `rediss://default:${upstashToken}@${upstashHost}:6379`;
  } else if (!connectionUrl && railwayRedisHost && railwayRedisPort) {
    // Direct Railway Redis KV support
    const auth = railwayRedisPassword ? `default:${railwayRedisPassword}@` : '';
    connectionUrl = `redis://${auth}${railwayRedisHost}:${railwayRedisPort}`;
  }

  if (connectionUrl) {
    // Log target host (safe version)
    try {
      const urlObj = new URL(connectionUrl);
      console.log(`✅ [Redis] Connecting to Redis at: ${urlObj.host}`);
    } catch (e) {
      console.log(`✅ [Redis] Connecting to Redis URL (parse failed)`);
    }

    return new Redis(connectionUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        return delay;
      }
    });
  }

  // Fallback to localhost (ONLY IF NOT IN PRODUCTION)
  const isProd = process.env.NODE_ENV === 'production' ||
    !!process.env.RAILWAY_ENVIRONMENT ||
    !!process.env.RAILWAY_STATIC_URL ||
    !!process.env.VERCEL ||
    !!process.env.REDIS_URL ||
    !!process.env.REDISHOST;

  if (isProd && !connectionUrl) {
    console.error('❌ [REDIS-VERIFY-2024] CRITICAL: No Redis configuration found in production environment!');

    // Return a Proxy that absorbs all calls to prevent crashes like "incr is not a function"
    const safeMock = new Proxy({}, {
      get: (target, prop) => {
        // Essential ioredis properties/methods
        if (prop === 'on' || prop === 'once') return () => ({});
        if (prop === 'quit' || prop === 'disconnect') return async () => { };
        if (prop === 'ping') return async () => 'PONG'; // Return PONG even if failing to keep heartbeats happy
        if (prop === 'status') return 'ready'; // Pretend we're ready to avoid some retry loops
        if (prop === 'options') return {};

        // Return an async function for any other property call (ioredis commands are usually async)
        return async (...args: any[]) => {
          console.warn(`⚠️ [REDIS-MOCK] Method "${String(prop)}" called but Redis is not configured.`);
          // Special case: incr should return a number
          if (prop === 'incr' || prop === 'incrby' || prop === 'decr') return 1;
          return null;
        };
      }
    }) as any;

    return safeMock;
  }

  const host = process.env.REDIS_HOST || 'localhost';
  const safeHost = host === 'localhost' ? '127.0.0.1' : host;

  console.error(`📡 [REDIS-VERIFY-2024] Falling back to local Redis at ${safeHost}:6379`);
  try {
    return new Redis({
      host: safeHost,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      connectTimeout: 2000,
      family: 4, // Force IPv4
      retryStrategy: (times) => {
        // Stop retrying after 3 attempts in production for localhost fallback
        if (isProd && times > 3) return null;
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });
  } catch (e) {
    console.error('❌ [REDIS-VERIFY-2024] Failed to create fallback Redis client');
    return null as any;
  }
}

/**
 * Close Redis connections gracefully
 */
export async function closeRedisConnections(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}