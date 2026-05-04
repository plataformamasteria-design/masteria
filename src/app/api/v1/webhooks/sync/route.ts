import { NextRequest, NextResponse } from 'next/server';
import { conn } from '@/lib/db';
import { parseAndValidatePayload, storeWebhookEvent, handleIncomingWebhookEvent } from '@/lib/webhooks/incoming-handler';

export const dynamic = 'force-dynamic';

interface GrapfyWebhookEvent {
  id: string;
  eventType: string;
  payload: any;
  status: string;
  httpCodeResponse: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /api/v1/webhooks/sync
 * Sincroniza eventos históricos do Grapfy
 * 
 * Body:
 * {
 *   "companyId": "company-uuid",
 *   "webhookSettingId": "grapfy-webhook-setting-id",
 *   "grapfyApiKey": "optional-grapfy-api-key",
 *   "limit": 100,
 *   "daysBack": 30
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`[WEBHOOK-SYNC:${requestId}] ===== INICIANDO SINCRONIZAÇÃO DE HISTÓRICO =====`);
    
    const body = await request.json();
    const { companyId, webhookSettingId, grapfyApiKey, limit = 100, daysBack = 30 } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId é obrigatório' }, { status: 400 });
    }

    if (!webhookSettingId) {
      return NextResponse.json({ error: 'webhookSettingId é obrigatório' }, { status: 400 });
    }

    // Validate company exists
    const companyResult = await conn`
      SELECT id FROM companies WHERE id = ${companyId} LIMIT 1
    `;

    if (!companyResult || (companyResult as any).length === 0) {
      console.warn(`[WEBHOOK-SYNC:${requestId}] Empresa não encontrada: ${companyId}`);
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    console.log(`[WEBHOOK-SYNC:${requestId}] Empresa: ${companyId}`);
    console.log(`[WEBHOOK-SYNC:${requestId}] Webhook Setting ID: ${webhookSettingId}`);

    // Para este MVP, vamos simular busca do histórico do Grapfy
    // Em produção, isso faria uma chamada real à API do Grapfy
    const historicalEvents = await fetchGrapfyHistoricalEvents(
      webhookSettingId,
      grapfyApiKey || process.env.GRAPFY_API_KEY,
      limit,
      daysBack,
      requestId
    );

    console.log(`[WEBHOOK-SYNC:${requestId}] Eventos históricos encontrados: ${historicalEvents.length}`);

    let successCount = 0;
    let errorCount = 0;
    const savedEventIds: string[] = [];

    // Process each historical event
    for (const event of historicalEvents) {
      try {
        // Check if event already exists
        const existingEvent = await conn`
          SELECT id FROM incoming_webhook_events 
          WHERE payload->>'eventId' = ${event.id} LIMIT 1
        `;

        if ((existingEvent as any).length > 0) {
          console.log(`[WEBHOOK-SYNC:${requestId}] Evento já existe: ${event.id}`);
          continue;
        }

        // Validate and parse the payload
        const validatedPayload = await parseAndValidatePayload(JSON.stringify(event.payload));
        
        if (!validatedPayload) {
          console.warn(`[WEBHOOK-SYNC:${requestId}] Falha ao validar payload: ${event.id}`);
          errorCount++;
          continue;
        }

        // Store webhook event
        const eventId = await storeWebhookEvent(
          companyId,
          'grapfy',
          validatedPayload.event_type as any,
          validatedPayload,
          {
            'x-sync-source': 'grapfy-historical',
            'x-original-webhook-id': event.id,
          },
          'sync-service',
          true // signature already validated by Grapfy
        );

        if (eventId) {
          savedEventIds.push(eventId);
          successCount++;

          // Process event asynchronously
          try {
            await handleIncomingWebhookEvent(companyId, 'grapfy', validatedPayload, eventId);
          } catch (err) {
            console.error(`[WEBHOOK-SYNC:${requestId}] Erro ao processar evento:`, err);
          }

          console.log(`[WEBHOOK-SYNC:${requestId}] ✅ Evento sincronizado: ${event.id}`);
        } else {
          errorCount++;
        }
      } catch (err) {
        console.error(`[WEBHOOK-SYNC:${requestId}] Erro ao processar evento ${event.id}:`, err);
        errorCount++;
      }
    }

    console.log(`[WEBHOOK-SYNC:${requestId}] ===== SINCRONIZAÇÃO CONCLUÍDA =====`);
    console.log(`[WEBHOOK-SYNC:${requestId}] Sucesso: ${successCount}, Erros: ${errorCount}`);

    return NextResponse.json({
      success: true,
      message: 'Sincronização concluída',
      summary: {
        total: historicalEvents.length,
        synced: successCount,
        errors: errorCount,
        savedEventIds,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[WEBHOOK-SYNC:${requestId}] Erro inesperado:`, error);
    return NextResponse.json(
      {
        error: 'Erro ao sincronizar histórico',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

/**
 * Busca eventos históricos do Grapfy
 * Este é um placeholder - em produção, seria uma chamada real à API do Grapfy
 */
async function fetchGrapfyHistoricalEvents(
  webhookSettingId: string,
  apiKey: string | undefined,
  limit: number,
  daysBack: number,
  requestId: string
): Promise<GrapfyWebhookEvent[]> {
  try {
    if (!apiKey) {
      console.warn(`[WEBHOOK-SYNC:${requestId}] ⚠️ Grapfy API Key não configurada - retornando array vazio`);
      return [];
    }

    // URL da API do Grapfy - baseado na documentação
    const grapfyApiUrl = 'https://api.grapfy.com';
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    console.log(`[WEBHOOK-SYNC:${requestId}] Buscando eventos do Grapfy desde: ${since}`);

    // Fazer requisição para o Grapfy
    const response = await fetch(
      `${grapfyApiUrl}/webhook-events?webhookSettingId=${webhookSettingId}&since=${since}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`[WEBHOOK-SYNC:${requestId}] Erro na API do Grapfy: ${response.status}`);
      return [];
    }

    const data = await response.json();
    console.log(`[WEBHOOK-SYNC:${requestId}] ✅ Resposta do Grapfy: ${data.events?.length || 0} eventos`);

    return data.events || [];
  } catch (error) {
    console.error(`[WEBHOOK-SYNC:${requestId}] Erro ao buscar eventos históricos:`, error);
    return [];
  }
}

/**
 * GET /api/v1/webhooks/sync/status
 * Retorna status da sincronização
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId é obrigatório' }, { status: 400 });
    }

    // Count synchronized events (marked with x-sync-source header)
    const result = await conn`
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN headers->>'x-sync-source' = 'grapfy-historical' THEN 1 END) as synced_events,
        MAX(created_at) as last_sync_time
      FROM incoming_webhook_events 
      WHERE company_id = ${companyId}
    `;

    const stats = (result as any)?.[0] || { total_events: 0, synced_events: 0 };

    return NextResponse.json({
      companyId,
      totalEvents: stats.total_events,
      syncedFromGrapfy: stats.synced_events,
      lastSyncTime: stats.last_sync_time,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WEBHOOK-SYNC-GET]', error);
    return NextResponse.json(
      { error: 'Erro ao obter status' },
      { status: 500 }
    );
  }
}
