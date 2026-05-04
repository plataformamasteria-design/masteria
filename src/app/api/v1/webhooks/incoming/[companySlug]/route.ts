import { NextRequest, NextResponse } from 'next/server';
import { conn } from '@/lib/db';
import {
  validateWebhookSignature,
  parseAndValidatePayload,
  storeWebhookEvent,
  handleIncomingWebhookEvent,
} from '@/lib/webhooks/incoming-handler';
import { IncomingEventType } from '@/types/incoming-webhook';

export const dynamic = 'force-dynamic';

const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

/**
 * GET /api/v1/webhooks/incoming/[companySlug]
 * Health check endpoint for external platforms to verify webhook URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companySlug: string }> }
) {
  try {
    const { companySlug } = await params;
    console.log(`[WEBHOOK-HEALTH] Health check for company: ${companySlug}`);

    // Return 200 OK for health check
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  } catch (error) {
    console.error('[WEBHOOK-HEALTH] Error:', error);
    return NextResponse.json(
      { status: 'unhealthy' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/webhooks/incoming/[companySlug]
 * Main endpoint to receive incoming webhook events from external platforms
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companySlug: string }> }
) {
  const requestId = Math.random().toString(36).substring(7);
  const { companySlug } = await params;
  let source = request.headers.get('x-webhook-source') || 'unknown';

  // Auto-detect Grapfy if no source header (Grapfy doesn't send one)
  if (source === 'unknown') {
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const xForwarded = request.headers.get('x-forwarded-host') || '';
    // Try to detect Grapfy from various headers or default to grapfy if no source
    if (userAgent.toLowerCase().includes('grapfy') ||
      referer.toLowerCase().includes('grapfy') ||
      xForwarded.toLowerCase().includes('grapfy')) {
      source = 'grapfy';
    }
    // Fallback: if still unknown, default to grapfy (most likely external source)
    if (source === 'unknown') {
      source = 'grapfy';
    }
  }

  try {
    console.log(`[WEBHOOK:${requestId}] ===== INCOMING WEBHOOK RECEIVED =====`);
    console.log(`[WEBHOOK:${requestId}] Company: ${companySlug}`);
    console.log(`[WEBHOOK:${requestId}] Source: ${source}`);
    console.log(`[WEBHOOK:${requestId}] Headers: Content-Type=${request.headers.get('content-type')}, User-Agent=${request.headers.get('user-agent')}`);

    // Get raw body for signature validation
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature');
    const timestamp = request.headers.get('x-webhook-timestamp');

    console.log(`[WEBHOOK:${requestId}] Payload size: ${rawBody.length} bytes`);
    console.log(`[WEBHOOK:${requestId}] Raw payload (first 500 chars): ${rawBody.substring(0, 500)}`);
    console.log(`[WEBHOOK:${requestId}] Signature: ${signature ? 'present' : 'missing'}, Timestamp: ${timestamp || 'missing'}`);

    // Get the company from database using slug (companySlug is actually companyId in this case)
    const companyResult = await conn`
      SELECT id FROM companies WHERE id = ${companySlug} LIMIT 1
    `;

    if (!companyResult || (companyResult as any).length === 0) {
      console.warn(`[WEBHOOK:${requestId}] Company not found: ${companySlug}`);
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    const companyId = (companyResult as any)?.[0]?.id as string;

    // Get webhook config for this company/source (including auto-approach fields)
    let configResult = await conn`
      SELECT id, name, secret, is_active, source as config_source,
        COALESCE(auto_approach_enabled, false) as auto_approach_enabled,
        auto_approach_connection_id,
        COALESCE(auto_approach_message, '') as auto_approach_message,
        COALESCE(auto_approach_delay_seconds, 5) as auto_approach_delay_seconds,
        auto_approach_ai_persona_id
      FROM incoming_webhook_configs 
      WHERE company_id = ${companyId} AND source = ${source} AND is_active = true LIMIT 1
    `;

    // Fallback: if no config found for detected source, try any active config for this company
    if (!configResult || (configResult as any).length === 0) {
      console.log(`[WEBHOOK:${requestId}] No config for source '${source}', trying fallback (any active config)`);
      configResult = await conn`
        SELECT id, name, secret, is_active, source as config_source,
          COALESCE(auto_approach_enabled, false) as auto_approach_enabled,
          auto_approach_connection_id,
          COALESCE(auto_approach_message, '') as auto_approach_message,
          COALESCE(auto_approach_delay_seconds, 5) as auto_approach_delay_seconds,
          auto_approach_ai_persona_id
        FROM incoming_webhook_configs 
        WHERE company_id = ${companyId} AND is_active = true 
        ORDER BY created_at DESC LIMIT 1
      `;
      if (configResult && (configResult as any).length > 0) {
        source = (configResult as any)[0].config_source || source;
        console.log(`[WEBHOOK:${requestId}] Fallback matched config with source: ${source}`);
      }
    }

    let signatureValid = false;
    let secret = '';
    let webhookName = '';
    let webhookConfigFull: any = null;

    if (configResult && (configResult as any).length > 0) {
      const config = (configResult as any)?.[0];
      if (!config.is_active) {
        console.warn(`[WEBHOOK:${requestId}] Webhook config is inactive`);
        return NextResponse.json(
          { error: 'Webhook config is inactive' },
          { status: 403 }
        );
      }
      secret = config.secret;
      webhookName = config.name || '';

      // Extract auto-approach config for passing to handler
      webhookConfigFull = {
        id: config.id,
        auto_approach_enabled: config.auto_approach_enabled || false,
        auto_approach_connection_id: config.auto_approach_connection_id || null,
        auto_approach_message: config.auto_approach_message || '',
        auto_approach_delay_seconds: config.auto_approach_delay_seconds || 5,
        auto_approach_ai_persona_id: config.auto_approach_ai_persona_id || null,
      };

      // Validate signature (optional — external tools may not send signature headers)
      if (signature && timestamp && secret) {
        signatureValid = await validateWebhookSignature(
          rawBody,
          signature,
          timestamp,
          secret,
          isDev
        );

        if (!signatureValid && !isDev) {
          console.error(`[WEBHOOK:${requestId}] Invalid signature`);
          return NextResponse.json(
            { error: 'Invalid signature' },
            { status: 403 }
          );
        }
      } else {
        // No signature headers — accept but log warning
        console.log(`[WEBHOOK:${requestId}] No signature headers provided, accepting without signature validation`);
        signatureValid = false;
      }
    } else {
      console.warn(`[WEBHOOK:${requestId}] No webhook config found for source: ${source}`);
      if (!isDev) {
        return NextResponse.json(
          { error: 'Webhook config not found' },
          { status: 404 }
        );
      }
    }

    // Parse and validate payload
    const payload = await parseAndValidatePayload(rawBody);
    if (!payload) {
      console.error(`[WEBHOOK:${requestId}] Invalid payload format`);
      return NextResponse.json(
        { error: 'Invalid payload format' },
        { status: 400 }
      );
    }

    // Collect headers for logging
    const headers: Record<string, any> = {};
    request.headers.forEach((value, key) => {
      if (!key.includes('authorization') && !key.includes('signature')) {
        headers[key] = value;
      }
    });

    // Get client IP
    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Resolve event_type: prefer Zod-mapped event_type, fallback to eventType or auto-detect
    let resolvedEventType = (payload.event_type || (payload as any).eventType || '') as IncomingEventType;
    if (!resolvedEventType) {
      // Auto-detect from payload keys (form submissions, Grapfy, etc.)
      const keys = Object.keys(payload || {});
      const hasFormIndicators = keys.some(k =>
        ['email', '__submission', 'nome', 'name', 'telefone', 'phone', 'objetivo', 'formulario'].includes(k.toLowerCase())
      );
      if (hasFormIndicators) {
        resolvedEventType = 'form.submitted' as IncomingEventType;
      }
    }
    console.log(`[WEBHOOK:${requestId}] Resolved event_type: ${resolvedEventType || 'unknown'}`);

    // Store event in database
    const eventId = await storeWebhookEvent(
      companyId,
      source,
      resolvedEventType,
      payload,
      headers,
      ipAddress,
      signatureValid
    );

    if (!eventId) {
      console.error(`[WEBHOOK:${requestId}] Failed to store webhook event`);
      return NextResponse.json(
        { error: 'Failed to store webhook event' },
        { status: 500 }
      );
    }

    console.log(`[WEBHOOK:${requestId}] ✅ Event stored with ID: ${eventId}`);

    // Process event — MUST await to prevent serverless runtime from killing before completion
    try {
      await handleIncomingWebhookEvent(companyId, source, payload, eventId, webhookName, webhookConfigFull);
    } catch (error) {
      console.error(`[WEBHOOK:${requestId}] Error in event processing:`, error);
    }

    console.log(`[WEBHOOK:${requestId}] ===== WEBHOOK PROCESSED =====`);

    return NextResponse.json({
      success: true,
      eventId,
      message: 'Webhook received and processed successfully',
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  } catch (error) {
    console.error(`[WEBHOOK:${requestId}] Unexpected error:`, error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
