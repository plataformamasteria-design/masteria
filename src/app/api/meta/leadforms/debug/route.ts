/**
 * GET /api/meta/leadforms/debug
 * Diagnóstico completo — versão final
 */

import { NextResponse } from 'next/server';
import { getMetaAuthForSession, META_BASE } from '@/lib/meta-ads';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await getMetaAuthForSession();
    const { token, accountId } = auth;
    const results: Record<string, any> = { accountId, companyId: auth.companyId };

    // 1. Quem é o usuário
    try {
      const r = await fetch(`${META_BASE}/me?fields=id,name&access_token=${token}`, { cache: 'no-store' });
      results.me = await r.json();
    } catch (e: any) { results.me_error = e.message; }

    // 2. Permissões
    try {
      const r = await fetch(`${META_BASE}/me/permissions?access_token=${token}`, { cache: 'no-store' });
      const d = await r.json();
      results.has_leads_retrieval = (d.data || []).some((p: any) => p.permission === 'leads_retrieval' && p.status === 'granted');
      results.permissions_granted = (d.data || []).filter((p: any) => p.status === 'granted').map((p: any) => p.permission);
    } catch (e: any) { results.permissions_error = e.message; }

    // 3. Páginas pessoais
    try {
      const qs = new URLSearchParams({ access_token: token, fields: 'id,name', limit: '50' });
      const r = await fetch(`${META_BASE}/me/accounts?${qs}`, { cache: 'no-store' });
      const d = await r.json();
      results.personal_pages = d.data?.map((p: any) => ({ id: p.id, name: p.name })) || [];
    } catch (e: any) { results.personal_pages_error = e.message; }

    // 4. AdCreatives com lead_gen_form_id
    if (accountId) {
      try {
        const r = await fetch(
          `${META_BASE}/${accountId}/adcreatives?fields=id,lead_gen_form_id&limit=200&access_token=${token}`,
          { cache: 'no-store' }
        );
        const d = await r.json();
        results.adcreatives_error = d.error?.message;
        const withForms = (d.data || []).filter((c: any) => c.lead_gen_form_id);
        results.adcreatives_total = d.data?.length || 0;
        results.adcreatives_with_form = withForms.length;
        results.unique_form_ids = [...new Set(withForms.map((c: any) => c.lead_gen_form_id))];
      } catch (e: any) { results.adcreatives_error = e.message; }
    }

    // 5. Page IDs usadas em campanhas de lead gen
    if (accountId) {
      try {
        const qs = new URLSearchParams({
          access_token: token,
          fields: 'id,name,objective,adsets{promoted_object}',
          filtering: JSON.stringify([{ field: 'objective', operator: 'IN', value: ['LEAD_GENERATION', 'OUTCOME_LEADS'] }]),
          limit: '50',
        });
        const r = await fetch(`${META_BASE}/${accountId}/campaigns?${qs}`, { cache: 'no-store' });
        const d = await r.json();
        results.lead_campaigns_error = d.error?.message;
        results.lead_campaigns_count = d.data?.length || 0;
        
        const pageIds = new Set<string>();
        for (const campaign of (d.data || [])) {
          for (const adset of (campaign.adsets?.data || [])) {
            if (adset.promoted_object?.page_id) pageIds.add(adset.promoted_object.page_id);
          }
        }
        results.page_ids_from_campaigns = Array.from(pageIds);
      } catch (e: any) { results.campaigns_error = e.message; }
    }

    // 6. Para cada page_id das campanhas, tentar leadgen_forms
    if (results.page_ids_from_campaigns?.length > 0) {
      const pageFormTests: Record<string, any> = {};
      for (const pageId of results.page_ids_from_campaigns.slice(0, 5)) {
        try {
          const qs = new URLSearchParams({ access_token: token, fields: 'id,name,status', limit: '10' });
          const r = await fetch(`${META_BASE}/${pageId}/leadgen_forms?${qs}`, { cache: 'no-store' });
          const d = await r.json();
          pageFormTests[pageId] = { forms_count: d.data?.length || 0, error: d.error?.message, forms: d.data?.slice(0, 3).map((f: any) => ({ id: f.id, name: f.name })) || [] };
        } catch (e: any) { pageFormTests[pageId] = { error: e.message }; }
      }
      results.forms_by_campaign_page = pageFormTests;
    }

    return NextResponse.json(results, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
