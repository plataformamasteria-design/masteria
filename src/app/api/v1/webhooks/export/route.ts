import { NextRequest, NextResponse } from 'next/server';
import { conn } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/webhooks/export?format=csv&companyId=xxx
 * Exporta eventos em CSV ou JSON
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json'; // csv ou json
    const companyId = searchParams.get('companyId');
    const eventType = searchParams.get('eventType');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId é obrigatório' }, { status: 400 });
    }

    // Verificar empresa
    const company = await conn`
      SELECT id FROM companies WHERE id = ${companyId} LIMIT 1
    `;

    if ((company as any).length === 0) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    // Build query using conn safely
    let events;
    
    if (eventType) {
      events = await conn`
        SELECT 
          id,
          event_type,
          source,
          created_at,
          payload->>'customer' as customer,
          payload->>'total' as total,
          payload->>'product' as product,
          payload->>'eventType' as eventType,
          signature_valid,
          processed_at
        FROM incoming_webhook_events
        WHERE company_id = ${companyId} AND event_type = ${eventType}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      events = await conn`
        SELECT 
          id,
          event_type,
          source,
          created_at,
          payload->>'customer' as customer,
          payload->>'total' as total,
          payload->>'product' as product,
          payload->>'eventType' as eventType,
          signature_valid,
          processed_at
        FROM incoming_webhook_events
        WHERE company_id = ${companyId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    if (format === 'csv') {
      return exportToCSV(events as any);
    } else {
      return exportToJSON(events as any);
    }
  } catch (error) {
    console.error('[EXPORT-API]', error);
    return NextResponse.json(
      { error: 'Erro ao exportar dados' },
      { status: 500 }
    );
  }
}

function exportToJSON(events: any[]): NextResponse {
  const json = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      totalEvents: events.length,
      events: events.map((e) => ({
        id: e.id,
        type: e.event_type,
        customer: parseJSON(e.customer),
        product: parseJSON(e.product),
        total: e.total,
        source: e.source,
        processedAt: e.processed_at,
        createdAt: e.created_at,
      })),
    },
    null,
    2
  );

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="webhooks-export-${Date.now()}.json"`,
    },
  });
}

function exportToCSV(events: any[]): NextResponse {
  const headers = [
    'ID',
    'Tipo',
    'Cliente',
    'Produto',
    'Total',
    'Origem',
    'Processado',
    'Data',
  ];

  const rows = events.map((e) => [
    e.id,
    e.event_type,
    parseCustomerName(e.customer),
    parseProductName(e.product),
    e.total || '-',
    e.source,
    e.processed_at ? 'Sim' : 'Não',
    new Date(e.created_at).toLocaleString('pt-BR'),
  ]);

  // CSV content
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) =>
          typeof cell === 'string' && cell.includes(',')
            ? `"${cell}"`
            : cell
        )
        .join(',')
    ),
  ].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="webhooks-export-${Date.now()}.csv"`,
    },
  });
}

function parseJSON(value: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseCustomerName(customer: string | null): string {
  if (!customer) return '-';
  try {
    const obj = JSON.parse(customer);
    return obj.name || obj.id || '-';
  } catch {
    return customer;
  }
}

function parseProductName(product: string | null): string {
  if (!product) return '-';
  try {
    const obj = JSON.parse(product);
    return obj.name || obj.id || '-';
  } catch {
    return product;
  }
}
