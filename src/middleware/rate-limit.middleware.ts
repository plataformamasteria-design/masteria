import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import {
  checkRateLimits,
  checkIpRateLimit,
  checkAuthRateLimit,
  getClientIp
} from '@/lib/rate-limiter';
import redis from '@/lib/redis';

// In-memory rate limiter fallback for Redis unavailability
class InMemoryRateLimiter {
  private requests: Map<string, { count: number; windowStart: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, data] of this.requests.entries()) {
      // Remove entries older than 15 minutes (max window)
      if (now - data.windowStart > 900000) {
        this.requests.delete(key);
      }
    }
  }

  async checkLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const data = this.requests.get(key);

    if (!data || (now - data.windowStart >= windowMs)) {
      // Start new window
      this.requests.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: limit - 1 };
    }

    if (data.count >= limit) {
      return { allowed: false, remaining: 0 };
    }

    // Increment counter
    data.count++;
    this.requests.set(key, data);
    return { allowed: true, remaining: limit - data.count };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global in-memory fallback instance
const inMemoryLimiter = new InMemoryRateLimiter();

const isNonProd = process.env.NODE_ENV !== 'production';
const rateLimitDisabled = isNonProd && process.env.RATE_LIMIT_DISABLED === 'true';

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Rate limit configuration
const RATE_LIMITS = {
  authenticated: {
    company: { limit: 60, windowSeconds: 60 },
    user: { limit: 20, windowSeconds: 60 },
  },
  auth: {
    ip: {
      limit: envNumber('RATE_LIMIT_AUTH_IP_LIMIT', 15),  // Increased from 5
      windowSeconds: envNumber('RATE_LIMIT_AUTH_IP_WINDOW_SECONDS', 900),
    }, // defaults: 5 attempts in 15 minutes
  },
  public: {
    ip: { limit: 10, windowSeconds: 60 }, // 10 requests per minute
  }
};

interface RateLimitContext {
  userId?: string;
  companyId?: string;
  ipAddress: string;
  path: string;
}

let lastRedisCheck: { available: boolean; timestamp: number } | null = null;
const REDIS_CHECK_CACHE_MS = 5000; // Cache Redis availability for 5 seconds

async function checkRedisAvailability(): Promise<boolean> {
  const now = Date.now();
  if (lastRedisCheck && (now - lastRedisCheck.timestamp) < REDIS_CHECK_CACHE_MS) {
    return lastRedisCheck.available;
  }

  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Redis timeout')), 500)
    );
    await Promise.race([redis.ping(), timeout]);
    lastRedisCheck = { available: true, timestamp: now };
    return true;
  } catch {
    lastRedisCheck = { available: false, timestamp: now };
    return false;
  }
}

async function extractSessionData(request: NextRequest): Promise<{ userId?: string; companyId?: string }> {
  const sessionToken =
    request.cookies.get('__session')?.value ||
    request.cookies.get('session_token')?.value;

  if (!sessionToken) {
    return {};
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET_KEY_CALL;
    if (!JWT_SECRET) {
      console.error('[RateLimit] JWT_SECRET_KEY_CALL not configured');
      return {};
    }

    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(sessionToken, secret);

    return {
      userId: payload.userId as string | undefined,
      companyId: payload.companyId as string | undefined,
    };
  } catch (error) {
    // Invalid or expired token - treat as unauthenticated
    return {};
  }
}

async function applyRateLimitWithFallback(
  context: RateLimitContext,
  limitsConfig: typeof RATE_LIMITS[keyof typeof RATE_LIMITS]
): Promise<{
  allowed: boolean;
  message?: string;
  headers: Record<string, string>;
}> {
  const isRedisAvailable = await checkRedisAvailability();

  if (!isRedisAvailable) {
    console.warn('[RateLimit] Redis unavailable, using in-memory fallback');
  }

  // Determine which limits to apply based on context
  const limitsToCheck: Array<{
    key: string;
    limit: number;
    windowSeconds: number;
    type: string;
  }> = [];

  // Add company limit if available
  if ('company' in limitsConfig && context.companyId) {
    limitsToCheck.push({
      key: `rate_limit:company:${context.companyId}`,
      limit: limitsConfig.company.limit,
      windowSeconds: limitsConfig.company.windowSeconds,
      type: 'company',
    });
  }

  // Add user limit if available
  if ('user' in limitsConfig && context.userId) {
    limitsToCheck.push({
      key: `rate_limit:user:${context.userId}`,
      limit: limitsConfig.user.limit,
      windowSeconds: limitsConfig.user.windowSeconds,
      type: 'user',
    });
  }

  // Add IP limit if available
  if ('ip' in limitsConfig) {
    limitsToCheck.push({
      key: `rate_limit:ip:${context.ipAddress}`,
      limit: limitsConfig.ip.limit,
      windowSeconds: limitsConfig.ip.windowSeconds,
      type: 'ip',
    });
  }

  // Check limits based on availability of Redis
  for (const limitCheck of limitsToCheck) {
    if (isRedisAvailable) {
      // Use Redis-based rate limiter
      let allowed = false;
      let message = '';

      if (limitCheck.type === 'company' && context.companyId && context.userId) {
        const result = await checkRateLimits(context.companyId, context.userId);
        allowed = result.allowed;
        message = result.message || '';
      } else if (limitCheck.type === 'user' && context.userId && context.companyId) {
        const result = await checkRateLimits(context.companyId, context.userId);
        allowed = result.allowed;
        message = result.message || '';
      } else if (limitCheck.type === 'ip' && context.path.includes('/auth/')) {
        const result = await checkAuthRateLimit(context.ipAddress);
        allowed = result.allowed;
        message = result.message || '';
      } else if (limitCheck.type === 'ip') {
        const result = await checkIpRateLimit(context.ipAddress);
        allowed = result.allowed;
        message = result.message || '';
      }

      if (!allowed) {
        return {
          allowed: false,
          message,
          headers: {
            'X-RateLimit-Limit': limitCheck.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + limitCheck.windowSeconds * 1000).toISOString(),
            'Retry-After': limitCheck.windowSeconds.toString(),
          },
        };
      }
    } else {
      // Use in-memory fallback
      const result = await inMemoryLimiter.checkLimit(
        limitCheck.key,
        limitCheck.limit,
        limitCheck.windowSeconds * 1000
      );

      if (!result.allowed) {
        return {
          allowed: false,
          message: `Rate limit exceeded. Please try again later.`,
          headers: {
            'X-RateLimit-Limit': limitCheck.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + limitCheck.windowSeconds * 1000).toISOString(),
            'Retry-After': limitCheck.windowSeconds.toString(),
            'X-RateLimit-Fallback': 'true', // Indicate fallback mode
          },
        };
      }

      // Add remaining count header for successful requests
      return {
        allowed: true,
        headers: {
          'X-RateLimit-Limit': limitCheck.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(Date.now() + limitCheck.windowSeconds * 1000).toISOString(),
          'X-RateLimit-Fallback': 'true',
        },
      };
    }
  }

  // All limits passed
  return {
    allowed: true,
    headers: {},
  };
}

/**
 * Rate limiting middleware for Next.js App Router
 * Protects API routes with appropriate rate limits
 */
export async function rateLimitMiddleware(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  if (rateLimitDisabled) {
    return handler();
  }

  const path = request.nextUrl.pathname;
  const ipAddress = getClientIp(request.headers);

  // Skip rate limiting for non-API routes
  if (!path.startsWith('/api/')) {
    return handler();
  }

  // Extract session data
  const { userId, companyId } = await extractSessionData(request);

  const context: RateLimitContext = {
    userId,
    companyId,
    ipAddress,
    path,
  };

  let limitsConfig: typeof RATE_LIMITS[keyof typeof RATE_LIMITS];

  // Determine which rate limits to apply based on route
  if (path.startsWith('/api/auth/') || path.startsWith('/api/v1/auth/')) {
    // Auth routes - use auth-specific limits
    limitsConfig = RATE_LIMITS.auth;
  } else if (path.startsWith('/api/v1/')) {
    // Authenticated API routes
    if (!userId || !companyId) {
      // No valid session - treat as public with stricter limits
      limitsConfig = RATE_LIMITS.public;
    } else {
      limitsConfig = RATE_LIMITS.authenticated;
    }
  } else {
    // Other public API routes
    limitsConfig = RATE_LIMITS.public;
  }

  // Apply rate limiting
  const result = await applyRateLimitWithFallback(context, limitsConfig);

  if (!result.allowed) {
    // Return 429 Too Many Requests
    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: result.message || 'Rate limit exceeded. Please try again later.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...result.headers,
        },
      }
    );
  }

  // Request allowed - execute handler and add rate limit headers
  const response = await handler();

  // Add rate limit headers to successful response
  Object.entries(result.headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Helper function to wrap API route handlers with rate limiting
 * Usage: export const GET = withRateLimit(handler);
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    return rateLimitMiddleware(request, () => handler(request));
  };
}

/**
 * Get current rate limit status for a user/company
 * Useful for displaying limits in UI
 */
export async function getRateLimitStatus(
  _userId: string,
  _companyId: string,
  _ipAddress: string
): Promise<{
  user: { limit: number; remaining: number; resetAt: Date };
  company: { limit: number; remaining: number; resetAt: Date };
  ip: { limit: number; remaining: number; resetAt: Date };
}> {
  const now = Date.now();
  const isRedisAvailable = await checkRedisAvailability();

  if (!isRedisAvailable) {
    // Return fallback status
    return {
      user: {
        limit: RATE_LIMITS.authenticated.user.limit,
        remaining: RATE_LIMITS.authenticated.user.limit,
        resetAt: new Date(now + 60000),
      },
      company: {
        limit: RATE_LIMITS.authenticated.company.limit,
        remaining: RATE_LIMITS.authenticated.company.limit,
        resetAt: new Date(now + 60000),
      },
      ip: {
        limit: RATE_LIMITS.public.ip.limit,
        remaining: RATE_LIMITS.public.ip.limit,
        resetAt: new Date(now + 60000),
      },
    };
  }

  // Get actual counts from Redis
  // This would require modifying the rate limiter to expose count methods
  // For now, return estimated values
  return {
    user: {
      limit: RATE_LIMITS.authenticated.user.limit,
      remaining: RATE_LIMITS.authenticated.user.limit,
      resetAt: new Date(now + 60000),
    },
    company: {
      limit: RATE_LIMITS.authenticated.company.limit,
      remaining: RATE_LIMITS.authenticated.company.limit,
      resetAt: new Date(now + 60000),
    },
    ip: {
      limit: RATE_LIMITS.public.ip.limit,
      remaining: RATE_LIMITS.public.ip.limit,
      resetAt: new Date(now + 60000),
    },
  };
}
