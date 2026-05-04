import { NextRequest } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const BAILEYS_SERVICE_URL = process.env.BAILEYS_SERVICE_URL || 'http://localhost:3001';
const BAILEYS_SERVICE_API_KEY = process.env.BAILEYS_SERVICE_API_KEY || '';

/**
 * QR Code SSE Proxy
 * Proxies the SSE stream from the Baileys microservice to the browser.
 * 
 * The actual Baileys sessions live in a separate microservice on Railway,
 * so we can't access local EventEmitters. Instead, we proxy the
 * microservice's /qr/stream SSE endpoint.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    console.log('[QR SSE Proxy] Starting QR stream for session:', id);

    const companyId = await getCompanyIdFromSession();

    // Validate connection belongs to user's company
    const connection = await db.query.connections.findFirst({
      where: and(
        eq(connections.id, id),
        eq(connections.companyId, companyId)
      ),
    });

    if (!connection) {
      console.error('[QR SSE Proxy] Connection not found. Session ID:', id, 'Company ID:', companyId);
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Ensure the session is created/resumed in the microservice
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (BAILEYS_SERVICE_API_KEY) {
        headers['x-api-key'] = BAILEYS_SERVICE_API_KEY;
      }

      const createRes = await fetch(`${BAILEYS_SERVICE_URL}/api/sessions/${id}/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ companyId }),
        signal: AbortSignal.timeout(15000),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        console.warn('[QR SSE Proxy] Create session warning:', err);
        // Non-fatal: session might already exist
      }
    } catch (createError) {
      console.warn('[QR SSE Proxy] Create session failed (non-fatal):', createError);
    }

    // Proxy the SSE stream from the Baileys microservice
    const sseHeaders: Record<string, string> = {};
    if (BAILEYS_SERVICE_API_KEY) {
      sseHeaders['x-api-key'] = BAILEYS_SERVICE_API_KEY;
    }

    const upstreamUrl = `${BAILEYS_SERVICE_URL}/api/sessions/${id}/qr/stream`;
    console.log('[QR SSE Proxy] Connecting to upstream SSE:', upstreamUrl);

    const upstreamRes = await fetch(upstreamUrl, {
      headers: sseHeaders,
      signal: request.signal,
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      console.error('[QR SSE Proxy] Upstream SSE failed:', upstreamRes.status);
      return new Response(
        JSON.stringify({ error: 'Failed to connect to Baileys service' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Transparently proxy the SSE stream from microservice to client
    return new Response(upstreamRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[QR SSE Proxy] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
