import { NextRequest, NextResponse } from 'next/server';

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, RateLimitBucket>();
const RATE_LIMIT_REQUESTS = 100; // 100 requests per minute
const RATE_LIMIT_INTERVAL = 60 * 1000; // 1 minute

export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function checkRateLimit(
  key: string,
  limit: number = RATE_LIMIT_REQUESTS
): Promise<{ limited: boolean; remaining: number; resetTime: number }> {
  const now = Date.now();
  
  if (!buckets.has(key)) {
    buckets.set(key, {
      tokens: limit,
      lastRefill: now,
    });
  }

  const bucket = buckets.get(key)!;
  const timePassed = now - bucket.lastRefill;
  const tokensToAdd = (timePassed / RATE_LIMIT_INTERVAL) * limit;

  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(limit, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  if (bucket.tokens < 1) {
    const resetTime = now + (RATE_LIMIT_INTERVAL - timePassed);
    return {
      limited: true,
      remaining: 0,
      resetTime,
    };
  }

  bucket.tokens--;
  return {
    limited: false,
    remaining: Math.floor(bucket.tokens),
    resetTime: 0,
  };
}

export function createRateLimitResponse(resetTime: number) {
  return NextResponse.json(
    { error: 'Too Many Requests', retryAfter: Math.ceil((resetTime - Date.now()) / 1000) },
    { status: 429, headers: { 'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString() } }
  );
}

export async function withRateLimit(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>,
  limitPerMinute?: number
) {
  const ip = getClientIP(request);
  const limit = await checkRateLimit(ip, limitPerMinute || RATE_LIMIT_REQUESTS);

  if (limit.limited) {
    return createRateLimitResponse(limit.resetTime);
  }

  const response = await handler(request);
  response.headers.set('X-RateLimit-Remaining', limit.remaining.toString());
  return response;
}
