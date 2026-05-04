import redis from './redis';
import { recordRateLimitCheck } from './metrics';

interface RateLimitResult {
  allowed: boolean;
  message?: string;
}

const COMPANY_LIMIT = 60; // Requisições por minuto por empresa
const USER_LIMIT = 20;    // Requisições por minuto por utilizador
const IP_LIMIT = 10;      // Requisições por minuto por IP (proteção brute-force)
const AUTH_LIMIT = 5;     // Tentativas de login por IP em 15 minutos

/**
 * Lua script atômico para sliding window rate limiting
 * Garante que toda operação (remover expirados + contar + adicionar) seja atômica
 * Elimina race conditions e é mais eficiente que pipelines
 * 
 * KEYS[1] = chave do sorted set
 * ARGV[1] = timestamp atual (ms)
 * ARGV[2] = janela de tempo (ms) - ex: 60000 para 1 minuto
 * ARGV[3] = limite de requisições
 * ARGV[4] = TTL em segundos
 * ARGV[5] = member único (timestamp-random)
 * 
 * Retorna: 1 se permitido, 0 se bloqueado
 */
const SLIDING_WINDOW_LUA_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local member = ARGV[5]

local window_start = now - window_ms

-- Remove timestamps expirados
redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

-- Conta requests válidos na janela
local count = redis.call('ZCARD', key)

-- Se excedeu limite, retorna 0 (bloqueado)
if count >= limit then
  return 0
end

-- Adiciona novo timestamp
redis.call('ZADD', key, now, member)

-- Define TTL para cleanup automático
redis.call('EXPIRE', key, ttl)

-- Retorna 1 (permitido)
return 1
`;

/**
 * TRUE SLIDING WINDOW implementation usando Lua script atômico
 * Elimina race conditions usando execução atômica no Redis
 */
async function checkSlidingWindowLimit(
  key: string,
  limit: number,
  windowSeconds: number = 60
): Promise<boolean> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const member = `${now}-${Math.random()}`;
  
  // Executa script Lua atomicamente
  const result = await redis.eval(
    SLIDING_WINDOW_LUA_SCRIPT,
    1, // número de KEYS
    key, // KEYS[1]
    now.toString(), // ARGV[1]
    windowMs.toString(), // ARGV[2]
    limit.toString(), // ARGV[3]
    windowSeconds.toString(), // ARGV[4]
    member // ARGV[5]
  ) as number;
  
  return result === 1;
}

export async function checkRateLimits(
  companyId: string,
  userId: string
): Promise<RateLimitResult> {
  const companyKey = `rate_limit:company:${companyId}`;
  const userKey = `rate_limit:user:${userId}`;

  const [companyAllowed, userAllowed] = await Promise.all([
    checkSlidingWindowLimit(companyKey, COMPANY_LIMIT, 60),
    checkSlidingWindowLimit(userKey, USER_LIMIT, 60),
  ]);

  // Record company rate limit check
  recordRateLimitCheck('company', companyId, companyAllowed);
  
  // Record user rate limit check  
  recordRateLimitCheck('user', userId, userAllowed);

  if (!userAllowed) {
    return {
      allowed: false,
      message: `Limite de requisições do utilizador excedido (${USER_LIMIT}/min). Tente novamente em breve.`,
    };
  }

  if (!companyAllowed) {
    return {
      allowed: false,
      message: `Limite de requisições da empresa excedido (${COMPANY_LIMIT}/min). Tente novamente em breve.`,
    };
  }

  return { allowed: true };
}

/**
 * Rate limiting por IP para prevenir brute-force/DoS
 * Usado em rotas públicas (login, register, etc)
 * TRUE SLIDING WINDOW de 60 segundos
 */
export async function checkIpRateLimit(
  ipAddress: string
): Promise<RateLimitResult> {
  const ipKey = `rate_limit:ip:${ipAddress}`;
  const allowed = await checkSlidingWindowLimit(ipKey, IP_LIMIT, 60);
  
  // Record IP rate limit check
  recordRateLimitCheck('ip', ipAddress, allowed);

  if (!allowed) {
    return {
      allowed: false,
      message: `Limite de requisições por IP excedido (${IP_LIMIT}/min). Tente novamente em 1 minuto.`,
    };
  }

  return { allowed: true };
}

/**
 * Rate limiting para tentativas de autenticação (login/register)
 * TRUE SLIDING WINDOW de 15 minutos para prevenir brute-force em credenciais
 */
export async function checkAuthRateLimit(
  ipAddress: string
): Promise<RateLimitResult> {
  const authKey = `rate_limit:auth:${ipAddress}`;
  const allowed = await checkSlidingWindowLimit(authKey, AUTH_LIMIT, 900); // 900s = 15 min
  
  // Record auth rate limit check
  recordRateLimitCheck('auth', ipAddress, allowed);

  if (!allowed) {
    return {
      allowed: false,
      message: `Muitas tentativas de login. Tente novamente em 15 minutos.`,
    };
  }

  return { allowed: true };
}

/**
 * Extrai IP real da requisição considerando proxies (X-Forwarded-For, X-Real-IP)
 * Função síncrona helper para uso em middleware
 */
export function getClientIp(headers: Headers): string {
  // Tenta X-Forwarded-For primeiro (proxy reverso)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For pode ter múltiplos IPs: "client, proxy1, proxy2"
    const ips = forwardedFor.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);
    const firstIp = ips[0];
    if (firstIp && firstIp.length > 0) {
      return firstIp; // Primeiro IP é o cliente original
    }
  }
  
  // Fallback para X-Real-IP
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback para IP direto (desenvolvimento local)
  return '127.0.0.1';
}
