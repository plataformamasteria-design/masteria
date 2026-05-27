/**
 * GET /api/meta/leadforms
 * Lista todos os formulários de leads (Lead Ads) disponíveis na conta.
 *
 * API: Meta Graph API v21.0
 * Estratégias em cascata (paramos na primeira que retorna resultados):
 *   1. GET /me/accounts → páginas pessoais do usuário → /{page_id}/leadgen_forms
 *   2. GET /me/businesses → páginas do Business Manager → /{page_id}/leadgen_forms
 *   3. GET /act_{id}/promotable_pages → páginas do ad account → /{page_id}/leadgen_forms
 *   4. GET /act_{id}/adcreatives → lead_gen_form_id por criativo → /{form_id} (hydrate)
 *
 * A estratégia 4 funciona mesmo sem acesso admin à página, usando apenas
 * as permissões ads_read + leads_retrieval do token.
 *
 * Permissão: leads_retrieval, pages_show_list, ads_read
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetaAuthForSession, META_BASE } from '@/lib/meta-ads';

export const dynamic = 'force-dynamic';

export interface MetaLeadForm {
  id: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED' | string;
  leads_count?: number;
  created_time?: string;
  page_id?: string;
  page_name?: string;
}

interface MetaPage {
  id: string;
  name: string;
  access_token?: string;
}

// ── Helpers de busca de páginas ───────────────────────────────────────────────

async function fetchPersonalPages(userToken: string): Promise<MetaPage[]> {
  try {
    const qs = new URLSearchParams({ access_token: userToken, fields: 'id,name,access_token', limit: '50' });
    const res = await fetch(`${META_BASE}/me/accounts?${qs}`, { cache: 'no-store' });
    const data = await res.json();
    if (data.error) { console.warn('[leadforms] /me/accounts:', data.error.message); return []; }
    return (data.data || []) as MetaPage[];
  } catch { return []; }
}

async function fetchBusinessPages(userToken: string): Promise<MetaPage[]> {
  try {
    const qs = new URLSearchParams({
      access_token: userToken,
      fields: 'id,name,owned_pages{id,name,access_token},client_pages{id,name,access_token}',
      limit: '10',
    });
    const res = await fetch(`${META_BASE}/me/businesses?${qs}`, { cache: 'no-store' });
    const data = await res.json();
    if (data.error) { console.warn('[leadforms] /me/businesses:', data.error.message); return []; }
    const pages: MetaPage[] = [];
    for (const biz of (data.data || [])) {
      for (const p of (biz.owned_pages?.data || [])) pages.push(p);
      for (const p of (biz.client_pages?.data || [])) pages.push(p);
    }
    return pages;
  } catch { return []; }
}

async function fetchAdAccountPages(accountId: string, userToken: string): Promise<MetaPage[]> {
  if (!accountId) return [];
  try {
    const qs = new URLSearchParams({ access_token: userToken, fields: 'id,name,access_token', limit: '50' });
    const res = await fetch(`${META_BASE}/${accountId}/promotable_pages?${qs}`, { cache: 'no-store' });
    const data = await res.json();
    if (data.error) { console.warn('[leadforms] promotable_pages:', data.error.message); return []; }
    return (data.data || []) as MetaPage[];
  } catch { return []; }
}

function dedupePages(pages: MetaPage[]): MetaPage[] {
  const seen = new Map<string, MetaPage>();
  for (const p of pages) {
    const existing = seen.get(p.id);
    if (!existing || (!existing.access_token && p.access_token)) seen.set(p.id, p);
  }
  return Array.from(seen.values());
}

// ── Busca formulários por página ──────────────────────────────────────────────

async function fetchPageForms(pageId: string, token: string, pageName: string): Promise<MetaLeadForm[]> {
  const qs = new URLSearchParams({
    access_token: token,
    fields: 'id,name,status,leads_count,created_time',
    limit: '100',
  });
  try {
    const res = await fetch(`${META_BASE}/${pageId}/leadgen_forms?${qs}`, { cache: 'no-store' });
    const data = await res.json();
    if (data.error) {
      console.warn(`[leadforms] leadgen_forms page ${pageId}:`, data.error.message);
      return [];
    }
    return ((data.data || []) as any[]).map((f: any) => ({
      id: f.id, name: f.name, status: f.status || 'UNKNOWN',
      leads_count: f.leads_count || 0, created_time: f.created_time || null,
      page_id: pageId, page_name: pageName,
    }));
  } catch { return []; }
}

// ── Estratégia 4: via criativos do ad account ─────────────────────────────────

/**
 * Busca form IDs através dos AdCreatives do ad account.
 * Usa: GET /act_{id}/adcreatives?fields=id,lead_gen_form_id
 * Funciona com apenas ads_read + leads_retrieval, sem acesso admin à página.
 */
async function fetchFormsViaAdCreatives(
  accountId: string,
  userToken: string,
): Promise<MetaLeadForm[]> {
  if (!accountId) return [];

  // Passo 4a: buscar form IDs dos criativos
  const formIds = new Set<string>();
  try {
    let url: string | null =
      `${META_BASE}/${accountId}/adcreatives?fields=id,lead_gen_form_id&limit=200&access_token=${userToken}`;

    // Paginar se necessário
    let pages = 0;
    while (url && pages < 5) {
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (data.error) {
        console.warn('[leadforms] adcreatives error:', data.error.message);
        break;
      }
      for (const creative of (data.data || [])) {
        if (creative.lead_gen_form_id) formIds.add(creative.lead_gen_form_id);
      }
      url = data.paging?.next || null;
      pages++;
    }
  } catch (e: any) {
    console.warn('[leadforms] adcreatives fetch error:', e.message);
  }

  console.log(`[leadforms] Strategy 4: ${formIds.size} form IDs from adcreatives`);
  if (formIds.size === 0) return [];

  // Passo 4b: hidratar cada form com seus detalhes
  const forms = await Promise.all(
    Array.from(formIds).map(async (formId): Promise<MetaLeadForm | null> => {
      try {
        const qs = new URLSearchParams({
          access_token: userToken,
          fields: 'id,name,status,leads_count,created_time,page{id,name}',
        });
        const res = await fetch(`${META_BASE}/${formId}?${qs}`, { cache: 'no-store' });
        const f = await res.json();
        if (f.error) {
          console.warn(`[leadforms] form ${formId} hydrate error:`, f.error.message);
          return null;
        }
        return {
          id: f.id,
          name: f.name || formId,
          status: f.status || 'UNKNOWN',
          leads_count: f.leads_count || 0,
          created_time: f.created_time || null,
          page_id: f.page?.id || null,
          page_name: f.page?.name || null,
        };
      } catch { return null; }
    })
  );

  return forms.filter((f): f is MetaLeadForm => f !== null);
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    const { token, accountId, companyId } = auth;

    const formMap = new Map<string, MetaLeadForm>();
    let pagesChecked = 0;
    let strategyUsed = 'none';

    // ── Estratégias 1–3: via páginas ──────────────────────────────────────────
    const [personalPages, bizPages, adAccountPages] = await Promise.all([
      fetchPersonalPages(token),
      fetchBusinessPages(token),
      fetchAdAccountPages(accountId, token),
    ]);

    const allPages = dedupePages([...personalPages, ...bizPages, ...adAccountPages]);
    pagesChecked = allPages.length;
    console.log(`[leadforms] Páginas: ${personalPages.length} pessoais + ${bizPages.length} biz + ${adAccountPages.length} adaccount = ${allPages.length} únicas (empresa=${companyId})`);

    if (allPages.length > 0) {
      const formsArrays = await Promise.all(
        allPages.map(p => fetchPageForms(p.id, p.access_token || token, p.name))
      );
      for (const arr of formsArrays) {
        for (const f of arr) if (!formMap.has(f.id)) formMap.set(f.id, f);
      }
      if (formMap.size > 0) strategyUsed = 'pages';
    }

    // ── Estratégia 4: via adcreatives (fallback) ──────────────────────────────
    if (formMap.size === 0) {
      console.log('[leadforms] Estratégia pages retornou 0 → tentando via adcreatives…');
      const creativeForms = await fetchFormsViaAdCreatives(accountId, token);
      for (const f of creativeForms) if (!formMap.has(f.id)) formMap.set(f.id, f);
      if (formMap.size > 0) strategyUsed = 'adcreatives';
    }

    const forms = Array.from(formMap.values());

    // Ordenar: ativos primeiro, depois leads_count desc
    forms.sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
      return (b.leads_count || 0) - (a.leads_count || 0);
    });

    console.log(`[leadforms] ✅ ${forms.length} formulários encontrados (strategy=${strategyUsed})`);
    return NextResponse.json({ data: forms, account: accountId, pages_checked: pagesChecked, strategy: strategyUsed });

  } catch (err: any) {
    console.error('[api/meta/leadforms]', err.message);
    if (err.message?.includes('Meta não conectado') || err.message?.includes('Token')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
