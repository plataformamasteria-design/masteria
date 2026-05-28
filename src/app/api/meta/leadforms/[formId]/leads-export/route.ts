/**
 * GET /api/meta/leadforms/[formId]/leads-export
 * Exporta todos os leads de um formulário como arquivo CSV.
 *
 * Pagina até 1.000 leads via Meta Graph API e gera CSV
 * com todas as colunas do formulário.
 *
 * Permissão necessária: leads_retrieval
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetaAuthForSession, META_BASE } from '@/lib/meta-ads';

export const dynamic = 'force-dynamic';

interface LeadField { name: string; values: string[] }

interface MetaLead {
  id: string;
  created_time: string;
  field_data: LeadField[];
}

async function fetchAllLeads(formId: string, token: string): Promise<MetaLead[]> {
  const all: MetaLead[] = [];
  let url: string | null =
    `${META_BASE}/${formId}/leads?fields=id,created_time,field_data&limit=100&access_token=${token}`;

  let pages = 0;
  while (url && pages < 10) {          // máx 1.000 leads (10 páginas × 100)
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    if (data.error) break;
    for (const lead of (data.data || [])) all.push(lead);
    url = data.paging?.next || null;
    pages++;
  }
  return all;
}

function toCSV(leads: MetaLead[]): string {
  if (leads.length === 0) return 'id,data,campo,valor\n';

  // Coleta todas as colunas únicas do formulário
  const fieldKeys = new Set<string>();
  for (const lead of leads) {
    for (const f of lead.field_data || []) fieldKeys.add(f.name);
  }

  const cols = ['id', 'data', ...Array.from(fieldKeys)];
  const escape = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`;

  const rows = [cols.map(escape).join(',')];
  for (const lead of leads) {
    const fieldMap: Record<string, string> = {};
    for (const f of lead.field_data || []) fieldMap[f.name] = f.values?.[0] || '';
    const row = cols.map(col => {
      if (col === 'id') return escape(lead.id);
      if (col === 'data') return escape(lead.created_time);
      return escape(fieldMap[col] || '');
    });
    rows.push(row.join(','));
  }
  return rows.join('\n');
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  try {
    const { formId } = await params;
    if (!formId) {
      return NextResponse.json({ error: 'formId obrigatório' }, { status: 400 });
    }

    const auth = await getMetaAuthForSession();
    const leads = await fetchAllLeads(formId, auth.token);

    if (leads.length === 0) {
      // Verifica se é erro de permissão vs. sem leads
      const check = await fetch(
        `${META_BASE}/${formId}/leads?limit=1&access_token=${auth.token}`,
        { cache: 'no-store' }
      );
      const checkData = await check.json();
      if (checkData.error) {
        return NextResponse.json(
          { error: `Meta API: ${checkData.error.message}` },
          { status: 403 }
        );
      }
    }

    const csv = toCSV(leads);
    const filename = `leads_${formId}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[leads-export]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
