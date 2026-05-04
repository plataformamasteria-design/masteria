import * as promClient from 'prom-client';

// Initialize default metrics collection (CPU, memory, etc.)
promClient.collectDefaultMetrics({
  prefix: 'mastercrm_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Create a registry for all metrics
export const register = promClient.register;

// ======================
// HTTP Metrics
// ======================

// HTTP request duration histogram
export const httpRequestDuration = new promClient.Histogram({
  name: 'mastercrm_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// HTTP request counter
export const httpRequestCounter = new promClient.Counter({
  name: 'mastercrm_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Active connections gauge
export const activeConnections = new promClient.Gauge({
  name: 'mastercrm_active_connections',
  help: 'Number of active HTTP connections',
});

// WebSocket connections gauge
export const websocketConnections = new promClient.Gauge({
  name: 'mastercrm_websocket_connections',
  help: 'Number of active WebSocket connections',
  labelNames: ['namespace'],
});

// ======================
// Database Metrics
// ======================

// Database query duration histogram
export const dbQueryDuration = new promClient.Histogram({
  name: 'mastercrm_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table', 'success'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

// Database connection pool metrics
export const dbConnectionPool = new promClient.Gauge({
  name: 'mastercrm_db_connection_pool_size',
  help: 'Database connection pool metrics',
  labelNames: ['state'], // 'active', 'idle', 'waiting'
});

// Database errors counter
export const dbErrorCounter = new promClient.Counter({
  name: 'mastercrm_db_errors_total',
  help: 'Total number of database errors',
  labelNames: ['operation', 'error_type'],
});

// ======================
// Cache Metrics
// ======================

// Cache hits counter
export const cacheHits = new promClient.Counter({
  name: 'mastercrm_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'], // 'memory', 'redis'
});

// Cache misses counter
export const cacheMisses = new promClient.Counter({
  name: 'mastercrm_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
});

// Cache operations counter
export const cacheOperations = new promClient.Counter({
  name: 'mastercrm_cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'cache_type'], // operation: 'get', 'set', 'del', 'expire'
});

// Cache size gauge
export const cacheSize = new promClient.Gauge({
  name: 'mastercrm_cache_size',
  help: 'Current cache size (number of keys)',
  labelNames: ['cache_type'],
});

// Cache memory usage gauge
export const cacheMemoryUsage = new promClient.Gauge({
  name: 'mastercrm_cache_memory_bytes',
  help: 'Cache memory usage in bytes',
  labelNames: ['cache_type'],
});

// ======================
// Queue Metrics
// ======================

// Queue size gauge
export const queueSize = new promClient.Gauge({
  name: 'mastercrm_queue_size',
  help: 'Current queue size',
  labelNames: ['queue_name', 'status'], // status: 'waiting', 'active', 'delayed', 'failed'
});

// Queue jobs processed counter
export const queueJobsProcessed = new promClient.Counter({
  name: 'mastercrm_queue_jobs_processed_total',
  help: 'Total number of queue jobs processed',
  labelNames: ['queue_name', 'status'], // status: 'completed', 'failed', 'retried'
});

// Queue processing duration
export const queueProcessingDuration = new promClient.Histogram({
  name: 'mastercrm_queue_processing_duration_seconds',
  help: 'Duration of queue job processing in seconds',
  labelNames: ['queue_name', 'job_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
});

// Webhook queue specific metrics
export const webhookQueueMetrics = {
  delivered: new promClient.Counter({
    name: 'mastercrm_webhooks_delivered_total',
    help: 'Total number of webhooks successfully delivered',
    labelNames: ['subscription_type', 'event_type'],
  }),
  failed: new promClient.Counter({
    name: 'mastercrm_webhooks_failed_total',
    help: 'Total number of failed webhook deliveries',
    labelNames: ['subscription_type', 'event_type', 'reason'],
  }),
  retries: new promClient.Counter({
    name: 'mastercrm_webhooks_retries_total',
    help: 'Total number of webhook retries',
    labelNames: ['subscription_type', 'event_type'],
  }),
};

// Campaign queue metrics
export const campaignQueueMetrics = {
  sent: new promClient.Counter({
    name: 'mastercrm_campaigns_messages_sent_total',
    help: 'Total number of campaign messages sent',
    labelNames: ['campaign_type', 'channel'], // channel: 'whatsapp', 'sms', 'email'
  }),
  failed: new promClient.Counter({
    name: 'mastercrm_campaigns_messages_failed_total',
    help: 'Total number of failed campaign messages',
    labelNames: ['campaign_type', 'channel', 'error_type'],
  }),
};

// ======================
// Rate Limiting Metrics
// ======================

// Rate limit rejections counter
export const rateLimitRejections = new promClient.Counter({
  name: 'mastercrm_rate_limit_rejections_total',
  help: 'Total number of rate limit rejections',
  labelNames: ['limit_type', 'resource'], // limit_type: 'user', 'company', 'ip', 'auth'
});

// Rate limit checks counter
export const rateLimitChecks = new promClient.Counter({
  name: 'mastercrm_rate_limit_checks_total',
  help: 'Total number of rate limit checks',
  labelNames: ['limit_type', 'result'], // result: 'allowed', 'rejected'
});

// ======================
// AI/Agent Metrics
// ======================

// AI request duration
export const aiRequestDuration = new promClient.Histogram({
  name: 'mastercrm_ai_request_duration_seconds',
  help: 'Duration of AI/LLM requests in seconds',
  labelNames: ['provider', 'model', 'operation'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
});

// AI token usage
export const aiTokenUsage = new promClient.Counter({
  name: 'mastercrm_ai_tokens_used_total',
  help: 'Total number of AI tokens used',
  labelNames: ['provider', 'model', 'type'], // type: 'input', 'output'
});

// AI errors
export const aiErrors = new promClient.Counter({
  name: 'mastercrm_ai_errors_total',
  help: 'Total number of AI/LLM errors',
  labelNames: ['provider', 'model', 'error_type'],
});

// ======================
// Business Metrics
// ======================

// Active users gauge
export const activeUsers = new promClient.Gauge({
  name: 'mastercrm_active_users',
  help: 'Number of active users',
  labelNames: ['company_id', 'user_type'],
});

// Messages processed
export const messagesProcessed = new promClient.Counter({
  name: 'mastercrm_messages_processed_total',
  help: 'Total number of messages processed',
  labelNames: ['channel', 'direction', 'status'], // direction: 'inbound', 'outbound'
});

// Conversations metrics
export const conversationMetrics = {
  created: new promClient.Counter({
    name: 'mastercrm_conversations_created_total',
    help: 'Total number of conversations created',
    labelNames: ['channel', 'initiated_by'],
  }),
  resolved: new promClient.Counter({
    name: 'mastercrm_conversations_resolved_total',
    help: 'Total number of conversations resolved',
    labelNames: ['channel', 'resolution_type'],
  }),
  duration: new promClient.Histogram({
    name: 'mastercrm_conversation_duration_seconds',
    help: 'Duration of conversations in seconds',
    labelNames: ['channel'],
    buckets: [60, 300, 600, 1800, 3600, 7200, 14400, 86400], // 1min to 24h
  }),
};

// ======================
// Authentication Metrics
// ======================

// Login attempts
export const authMetrics = {
  loginAttempts: new promClient.Counter({
    name: 'mastercrm_login_attempts_total',
    help: 'Total number of login attempts',
    labelNames: ['result', 'method'], // result: 'success', 'failed', method: 'password', 'oauth'
  }),
  sessionCreated: new promClient.Counter({
    name: 'mastercrm_sessions_created_total',
    help: 'Total number of sessions created',
    labelNames: ['type'], // type: 'user', 'api'
  }),
  tokenGenerated: new promClient.Counter({
    name: 'mastercrm_tokens_generated_total',
    help: 'Total number of authentication tokens generated',
    labelNames: ['type'], // type: 'access', 'refresh', 'api'
  }),
};

// ======================
// Helper Functions
// ======================

/**
 * Record HTTP request metrics
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  duration: number
) {
  const labels = {
    method: method.toUpperCase(),
    route: normalizeRoute(route),
    status_code: statusCode.toString(),
  };
  
  httpRequestDuration.observe(labels, duration / 1000); // Convert ms to seconds
  httpRequestCounter.inc(labels);
}

/**
 * Record database query metrics
 */
export function recordDbQuery(
  operation: string,
  table: string,
  duration: number,
  success: boolean,
  error?: string
) {
  const labels = {
    operation,
    table,
    success: success.toString(),
  };
  
  dbQueryDuration.observe(labels, duration / 1000);
  
  if (!success && error) {
    dbErrorCounter.inc({
      operation,
      error_type: getErrorType(error),
    });
  }
}

/**
 * Record cache metrics
 */
export function recordCacheOperation(
  operation: 'hit' | 'miss' | 'set' | 'del' | 'expire',
  cacheType: 'memory' | 'redis' = 'memory'
) {
  if (operation === 'hit') {
    cacheHits.inc({ cache_type: cacheType });
  } else if (operation === 'miss') {
    cacheMisses.inc({ cache_type: cacheType });
  }
  
  if (operation !== 'hit' && operation !== 'miss') {
    cacheOperations.inc({ operation, cache_type: cacheType });
  }
}

/**
 * Record rate limit check
 */
export function recordRateLimitCheck(
  limitType: string,
  resource: string,
  allowed: boolean
) {
  rateLimitChecks.inc({
    limit_type: limitType,
    result: allowed ? 'allowed' : 'rejected',
  });
  
  if (!allowed) {
    rateLimitRejections.inc({
      limit_type: limitType,
      resource,
    });
  }
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get metrics as JSON
 */
export async function getMetricsJson() {
  return register.getMetricsAsJSON();
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics() {
  register.clear();
}

// ======================
// Utility Functions
// ======================

/**
 * Normalize route path for consistent labeling
 * Converts /users/123 to /users/:id
 */
function normalizeRoute(route: string): string {
  if (!route) return 'unknown';
  
  // Common patterns to normalize
  const patterns = [
    // UUID pattern
    [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id'],
    // Numeric IDs
    [/\/\d+/g, '/:id'],
    // Alphanumeric IDs
    [/\/[a-z0-9]{20,}/gi, '/:id'],
    // Email addresses
    [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ':email'],
  ];
  
  let normalized = route;
  for (const [pattern, replacement] of patterns) {
    normalized = normalized.replace(pattern as RegExp, replacement as string);
  }
  
  return normalized;
}

/**
 * Categorize error types for better grouping
 */
function getErrorType(error: string): string {
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('timeout')) return 'timeout';
  if (lowerError.includes('connection')) return 'connection';
  if (lowerError.includes('constraint')) return 'constraint';
  if (lowerError.includes('duplicate')) return 'duplicate';
  if (lowerError.includes('not found')) return 'not_found';
  if (lowerError.includes('permission') || lowerError.includes('denied')) return 'permission';
  if (lowerError.includes('validation')) return 'validation';
  
  return 'other';
}