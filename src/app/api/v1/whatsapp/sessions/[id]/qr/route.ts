import { NextRequest } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { evolutionApiService } from '@/services/evolution-api.service';

export const dynamic = 'force-dynamic';

/**
 * QR Code SSE Proxy (Evolution API)
 * Emulates the SSE stream expected by the UI by polling Evolution API
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const companyId = await getCompanyIdFromSession();

    // Validate connection belongs to user's company
    const connection = await db.query.connections.findFirst({
      where: and(
        eq(connections.id, id),
        eq(connections.companyId, companyId)
      ),
    });

    if (!connection) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          try {
             controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch(e) {}
        };

        try {
          // Send initial connecting event
          sendEvent({ status: 'connecting' });

          let pollingAttempts = 0;
          const maxAttempts = 100; // 5 minutes (3s * 100)

          while (pollingAttempts < maxAttempts) {
            if (request.signal.aborted) break;
            
            try {
              // 1. Check connection state
              const stateData = await evolutionApiService.getConnectionState(id);
              const state = stateData?.instance?.state;

              if (state === 'open') {
                sendEvent({ status: 'connected' });
                break;
              }

              // 2. Fetch QR Code
              const connData = await evolutionApiService.getConnectionData(id);
              
              if (connData?.qrcode || connData?.base64) {
                 sendEvent({ qr: connData.qrcode || connData.base64 });
              }
            } catch (err) {
              console.warn('[QR Stream] Warning polling Evolution API:', err);
              // Ignore temporary errors and keep polling
            }

            pollingAttempts++;
            await new Promise(r => setTimeout(r, 3000));
          }
        } catch (error) {
          console.error('[QR Stream] Stream error:', error);
          sendEvent({ status: 'error', message: 'Falha ao obter QR Code' });
        } finally {
          try {
             controller.close();
          } catch(e) {}
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[QR Stream] Fatal Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

