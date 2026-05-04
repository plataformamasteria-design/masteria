import { NextRequest, NextResponse } from 'next/server';
import { 
  recordHttpRequest, 
  activeConnections,
  websocketConnections,
} from '@/lib/metrics';

// Track active connections
let currentActiveConnections = 0;

/**
 * Metrics middleware for Next.js
 * Tracks HTTP request metrics for monitoring and observability
 */
export function metricsMiddleware(request: NextRequest) {
  // Skip metrics collection for the metrics endpoint itself
  if (request.nextUrl.pathname === '/api/metrics') {
    return NextResponse.next();
  }

  // Skip static assets and Next.js internals
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/static') ||
    request.nextUrl.pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // Increment active connections
  currentActiveConnections++;
  activeConnections.set(currentActiveConnections);

  const startTime = Date.now();
  const method = request.method;
  const pathname = request.nextUrl.pathname;

  // Create a proxy response to capture status code
  const response = NextResponse.next();

  // Decrement active connections and record metrics after response
  try {
    // We need to wait for the response to complete
    // Note: In Next.js middleware, we can't directly access the response status
    // We'll need to handle this differently in the actual route handlers
    const duration = Date.now() - startTime;
    
    // For middleware, we can only track that a request was made
    // The actual status code tracking needs to be done in API routes
    recordHttpRequest(
      method,
      pathname,
      200, // Default to 200 in middleware, actual status tracked in routes
      duration
    );
  } finally {
    currentActiveConnections--;
    activeConnections.set(currentActiveConnections);
  }

  return response;
}

/**
 * Wrapper function for API routes to track metrics
 * This should be used in API route handlers
 */
export function withMetrics<T extends (...args: any[]) => any>(
  handler: T,
  routeName?: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();
    let statusCode = 200;
    let method = 'GET';
    let route = routeName || 'unknown';

    // Try to extract request info from arguments
    if (args[0] && typeof args[0] === 'object') {
      if ('method' in args[0]) {
        method = args[0].method || 'GET';
      }
      if ('url' in args[0]) {
        try {
          const url = new URL(args[0].url, 'http://localhost');
          route = routeName || url.pathname;
        } catch {
          // Ignore URL parsing errors
        }
      }
    }

    // Increment active connections
    currentActiveConnections++;
    activeConnections.set(currentActiveConnections);

    try {
      const result = await handler(...args);
      
      // Try to extract status code from response
      if (result && typeof result === 'object') {
        if ('status' in result && typeof result.status === 'number') {
          statusCode = result.status;
        } else if ('statusCode' in result && typeof result.statusCode === 'number') {
          statusCode = result.statusCode;
        }
      }

      return result;
    } catch (error) {
      // Set error status code
      statusCode = 500;
      if (error && typeof error === 'object' && 'statusCode' in error) {
        statusCode = (error as any).statusCode || 500;
      }
      throw error;
    } finally {
      // Record metrics
      const duration = Date.now() - startTime;
      recordHttpRequest(method, route, statusCode, duration);
      
      // Decrement active connections
      currentActiveConnections--;
      activeConnections.set(currentActiveConnections);
    }
  }) as T;
}

/**
 * Express-style middleware for metrics (for custom servers)
 */
export function createExpressMetricsMiddleware() {
  return (req: any, res: any, next: any) => {
    // Skip metrics endpoint
    if (req.path === '/api/metrics') {
      return next();
    }

    // Skip static assets
    if (req.path.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?)$/)) {
      return next();
    }

    const startTime = Date.now();
    const method = req.method;
    const route = req.route?.path || req.path || 'unknown';

    // Increment active connections
    currentActiveConnections++;
    activeConnections.set(currentActiveConnections);

    // Intercept response end
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      // Record metrics
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode || 200;
      
      recordHttpRequest(method, route, statusCode, duration);
      
      // Decrement active connections
      currentActiveConnections--;
      activeConnections.set(currentActiveConnections);

      // Call original end
      originalEnd.apply(res, args);
    };

    next();
  };
}

/**
 * Track WebSocket connections (for Socket.io)
 */
export function trackWebSocketConnection(namespace: string = 'default', increment: boolean = true) {
  if (increment) {
    websocketConnections.inc({ namespace });
  } else {
    websocketConnections.dec({ namespace });
  }
}

/**
 * Helper to wrap async route handlers with metrics
 */
export function metricsWrapper(routeName: string) {
  return function decorator<T extends (...args: any[]) => any>(handler: T): T {
    return withMetrics(handler, routeName);
  };
}