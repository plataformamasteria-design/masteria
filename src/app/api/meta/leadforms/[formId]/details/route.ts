/**
 * GET /api/meta/leadforms/[formId]/details
 * Retorna:
 *  - questions: perguntas/campos do formulário
 *  - leads: últimos 10 leads recebidos
 *
 * API: Meta Graph API v21.0
 * Auth: access_token por empresa (marketing_credentials)
 * Permissões necessárias: leads_retrieval, pages_read_engagement
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetaAuthForSession, META_BASE } from '@/lib/meta-ads';

export const dynamic = 'force-dynamic';

interface MetaQuestion {
  key: string;
  label: string;
  type: string;
  options?: string[];
}

interface MetaLeadEntry {
  id: string;
  created_time: string;
  field_data: { name: string; values: string[] }[];
}

/**
 * Busca perguntas do formulário.
 * Endpoint: GET /{form_id}?fields=id,name,status,questions,leads_count
 */
async function fetchFormQuestions(formId: string, token: string): Promise<{
  name: string;
  status: string;
  leads_count: number;
  questions: MetaQuestion[];
} | null> {
  try {
    const qs = new URLSearchParams({
      access_token: token,
      fields: 'id,name,status,leads_count,questions',
    });
    const res = await fetch(`${META_BASE}/${formId}?${qs}`, { cache: 'no-store' });
    const data = await res.json();
    if (data.error) {
      console.error('[leadforms/details] Erro ao buscar form questions:', data.error);
      return null;
    }
    return {
      name: data.name || '',
      status: data.status || 'UNKNOWN',
      leads_count: data.leads_count || 0,
      questions: (data.questions || []).map((q: any) => ({
        key: q.key || q.name || '',
        label: q.label || q.key || q.name || '',
        type: q.type || 'text',
        options: q.options?.map((o: any) => o.value || o) || [],
      })),
    };
  } catch (err: any) {
    console.error('[leadforms/details] Erro de rede ao buscar questions:', err.message);
    return null;
  }
}

/**
 * Busca os últimos leads enviados para este formulário.
 * Endpoint: GET /{form_id}/leads?fields=id,created_time,field_data&limit=10
 */
async function fetchFormLeads(formId: string, token: string): Promise<MetaLeadEntry[]> {
  try {
    const qs = new URLSearchParams({
      access_token: token,
      fields: 'id,created_time,field_data',
      limit: '10',
      sort: 'created_time_descending',
    });
    const res = await fetch(`${META_BASE}/${formId}/leads?${qs}`, { cache: 'no-store' });
    const data = await res.json();
    if (data.error) {
      console.error('[leadforms/details] Erro ao buscar leads:', data.error);
      return [];
    }
    return (data.data || []) as MetaLeadEntry[];
  } catch (err: any) {
    console.error('[leadforms/details] Erro de rede ao buscar leads:', err.message);
    return [];
  }
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

    // Busca questions e leads em paralelo
    const [formDetails, leads] = await Promise.all([
      fetchFormQuestions(formId, auth.token),
      fetchFormLeads(formId, auth.token),
    ]);

    return NextResponse.json({
      formId,
      name: formDetails?.name || '',
      status: formDetails?.status || 'UNKNOWN',
      leads_count: formDetails?.leads_count || 0,
      questions: formDetails?.questions || [],
      recent_leads: leads,
    });
  } catch (err: any) {
    console.error('[api/meta/leadforms/details]', err.message);
    if (err.message?.includes('Meta não conectado') || err.message?.includes('Token')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
