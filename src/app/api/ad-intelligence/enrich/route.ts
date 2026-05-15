/**
 * POST /api/ad-intelligence/enrich
 *
 * Enriquece TODOS os leads do CRM:
 * 1. Leads com ad_id → já atribuídos, mantém
 * 2. Leads sem ad_id → busca no GHL (contato completo) em batches paralelos
 * 3. Leads que ainda ficam sem ad_id → identifica canal de aquisição
 * 4. Nenhum lead fica sem canal
 * 5. Roda recalculate no final
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateCompositeScore } from "@/lib/traffic/score-calculator";
import { getGhlToken } from "@/lib/ghl-oauth";
import { verifySession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

const GHL_BASE = "https://services.leadconnectorhq.com";

let _ghlHeaders: Record<string, string> | null = null;
async function getGhlHeaders() {
  if (_ghlHeaders) return _ghlHeaders;
  const token = await getGhlToken();
  _ghlHeaders = { Authorization: `Bearer ${token}`, Version: "2021-07-28", "Content-Type": "application/json" };
  return _ghlHeaders;
}

// ==========================================
// FASE 1: Buscar ad_id do contato no GHL
// ==========================================

interface AttrResult {
  ad_id: string | null; adset_id: string | null; campaign_id: string | null;
  ad_name: string | null; utm_source: string | null; utm_medium: string | null;
  utm_content: string | null; ctwa_clid: string | null; session_source: string | null;
  detected_canal: string | null;
}

async function fetchContactAttr(contactId: string): Promise<AttrResult> {
  const empty: AttrResult = { ad_id: null, adset_id: null, campaign_id: null, ad_name: null, utm_source: null, utm_medium: null, utm_content: null, ctwa_clid: null, session_source: null, detected_canal: null };
  if (!contactId) return empty;

  try {
    const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, { headers: await getGhlHeaders() });
    if (!res.ok) return empty;
    const { contact } = await res.json();
    if (!contact) return empty;

    let ad_id: string | null = null;
    let adset_id: string | null = null;
    let campaign_id: string | null = null;
    let ad_name: string | null = null;
    let utm_source: string | null = null;
    let utm_medium: string | null = null;
    let utm_content: string | null = null;
    let ctwa_clid: string | null = null;
    let session_source: string | null = null;

    // customFields
    for (const cf of (contact.customFields || contact.customField || [])) {
      const key = (cf.key || cf.fieldKey || cf.id || "").toLowerCase();
      const val = cf.value || "";
      if (!val) continue;
      if (key.includes("ad_id") || key.includes("ad id") || key.includes("whatsapp_referral") || key.includes("source_id")) ad_id = val;
      else if (key.includes("adset_id") || key.includes("adset id")) adset_id = val;
      else if (key.includes("campaign_id") || key.includes("campaign id")) campaign_id = val;
      else if (key.includes("ad_name") || key.includes("ad name")) ad_name = val;
      else if (key.includes("ctwa_clid") || key.includes("ctwa")) ctwa_clid = val;
    }

    // attributionSource
    const attribution = contact.attributionSource || contact.attribution || null;
    if (attribution && typeof attribution === "object") {
      session_source = attribution.sessionSource || attribution.source || null;
      utm_source = attribution.utmSource || attribution.utm_source || utm_source;
      utm_medium = attribution.utmMedium || attribution.utm_medium || utm_medium;
      utm_content = attribution.utmContent || attribution.utm_content || utm_content;
      if (!ad_id && attribution.adId) ad_id = attribution.adId;
      if (!ad_id && attribution.ad_id) ad_id = attribution.ad_id;
      if (!ad_id && utm_content && /^\d+$/.test(utm_content)) ad_id = utm_content;
      if (!adset_id && attribution.adsetId) adset_id = attribution.adsetId;
      if (!campaign_id && attribution.campaignId) campaign_id = attribution.campaignId;
      if (!ctwa_clid && attribution.ctwaClid) ctwa_clid = attribution.ctwaClid;
      const url = attribution.url || attribution.mediumId || "";
      if (url && !ad_id) {
        const m = url.match(/[?&]ad_id=([^&]+)/);
        if (m) ad_id = m[1];
      }
    }

    // tags
    for (const tag of (contact.tags || [])) {
      const t = typeof tag === "string" ? tag : tag.name || "";
      if (t.startsWith("ad_id:")) ad_id = ad_id || t.replace("ad_id:", "");
      if (t.startsWith("adset_id:")) adset_id = adset_id || t.replace("adset_id:", "");
      if (t.startsWith("campaign_id:")) campaign_id = campaign_id || t.replace("campaign_id:", "");
    }

    // Detectar canal se não tem ad_id
    let detected_canal: string | null = null;
    if (!ad_id) {
      if (ctwa_clid) detected_canal = "Meta Ads (CTWA)";
      else if (utm_source?.toLowerCase().includes("facebook") || utm_source?.toLowerCase().includes("meta") || utm_source?.toLowerCase().includes("ig")) detected_canal = "Meta Ads";
      else if (utm_source?.toLowerCase().includes("google")) detected_canal = "Google Ads";
      else if (session_source?.toLowerCase().includes("facebook") || session_source?.toLowerCase().includes("instagram")) detected_canal = "Meta Orgânico";
      else if (session_source?.toLowerCase().includes("google")) detected_canal = "Google Orgânico";
      else if (session_source?.toLowerCase().includes("whatsapp") || session_source?.toLowerCase().includes("wpp")) detected_canal = "WhatsApp Direto";
      else if (session_source?.toLowerCase().includes("direct")) detected_canal = "Direto";
      else if (contact.source?.toLowerCase().includes("facebook") || contact.source?.toLowerCase().includes("meta")) detected_canal = "Meta Ads";
      else if (contact.source?.toLowerCase().includes("google")) detected_canal = "Google Ads";
      else if (contact.source?.toLowerCase().includes("whatsapp")) detected_canal = "WhatsApp Direto";
      else if (contact.source?.toLowerCase().includes("referral") || contact.source?.toLowerCase().includes("indicação") || contact.source?.toLowerCase().includes("indicacao")) detected_canal = "Indicação";
      else if (contact.source) detected_canal = contact.source;
      else if (utm_source) detected_canal = `UTM: ${utm_source}`;
      else if (session_source) detected_canal = session_source;
    }

    return { ad_id, adset_id, campaign_id, ad_name, utm_source, utm_medium, utm_content, ctwa_clid, session_source, detected_canal };
  } catch {
    return { ad_id: null, adset_id: null, campaign_id: null, ad_name: null, utm_source: null, utm_medium: null, utm_content: null, ctwa_clid: null, session_source: null, detected_canal: null };
  }
}

// Executa em batches paralelos de N
async function batchProcess<T, R>(items: T[], fn: (item: T) => Promise<R>, batchSize: number): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ==========================================
// FASE 2: Recalcular scores (inline)
// ==========================================

const ETAPA_TO_EVENTS: Record<string, string[]> = {
  oportunidade: ["entrada"],
  reuniao_agendada: ["entrada", "qualificado", "reuniao_agendada"],
  reuniao_feita: ["entrada", "qualificado", "reuniao_agendada", "reuniao_realizada"],
  proposta_enviada: ["entrada", "qualificado", "reuniao_agendada", "reuniao_realizada", "proposta_enviada"],
  follow_up: ["entrada", "qualificado", "reuniao_agendada", "reuniao_realizada"],
  assinatura_contrato: ["entrada", "qualificado", "reuniao_agendada", "reuniao_realizada", "proposta_enviada", "contrato_fechado"],
  comprou: ["entrada", "qualificado", "reuniao_agendada", "reuniao_realizada", "proposta_enviada", "contrato_fechado"],
  desistiu: ["entrada", "desqualificado"],
};

export async function POST() {
  const { error: authError } = await verifySession();
  if (authError) return authError;

  const startTime = Date.now();
  const stats = { total_leads: 0, ja_com_ad_id: 0, ad_id_encontrado: 0, canal_identificado: 0, sem_canal: 0, criativos: 0, audiencias: 0 };

  // 1. Buscar TODOS os leads do CRM
  const { data: allLeads, error: leadsErr } = await supabase
    .from("leads_crm")
    .select("ghl_opportunity_id, ghl_contact_id, ad_id, adset_id, campaign_id, ad_name, etapa, valor_total_projeto, nome, canal_aquisicao, session_source, ghl_created_at")
    .limit(2000);

  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 });
  if (!allLeads || allLeads.length === 0) return NextResponse.json({ message: "Nenhum lead no CRM", stats });

  stats.total_leads = allLeads.length;

  // 2. Separar leads com e sem ad_id
  const leadsComAd = allLeads.filter((l) => l.ad_id && l.ad_id.length > 0);
  const leadsSemAd = allLeads.filter((l) => !l.ad_id || l.ad_id.length === 0);
  stats.ja_com_ad_id = leadsComAd.length;

  // 3. Buscar atribuição no GHL para leads sem ad_id (batches de 5 em paralelo)
  const enrichResults = await batchProcess(
    leadsSemAd,
    async (lead) => {
      const attr = await fetchContactAttr(lead.ghl_contact_id);
      return { lead, attr };
    },
    5
  );

  // 4. Atualizar cada lead no banco
  for (const { lead, attr } of enrichResults) {
    const updateData: Record<string, unknown> = {};

    if (attr.ad_id) {
      // Encontrou ad_id!
      updateData.ad_id = attr.ad_id;
      if (attr.adset_id) updateData.adset_id = attr.adset_id;
      if (attr.campaign_id) updateData.campaign_id = attr.campaign_id;
      if (attr.ad_name) updateData.ad_name = attr.ad_name;
      stats.ad_id_encontrado++;
    } else {
      // Sem ad_id — identificar canal
      let canal = attr.detected_canal;
      if (!canal) {
        // Fallback usando dados que já estão no banco
        const src = (lead.canal_aquisicao || "").toLowerCase();
        // Instagram como origem própria: lead com handle de instagram OU funil "Social Selling" com instagram preenchido
        if (lead.instagram && (src.includes("instagram") || src.includes("social") || !src || src === "desconhecido")) canal = "Instagram";
        else if (src.includes("facebook") || src.includes("meta")) canal = "Meta Ads";
        else if (src.includes("google")) canal = "Google Ads";
        else if (src.includes("whatsapp") || src.includes("wpp")) canal = "WhatsApp Direto";
        else if (src.includes("indicação") || src.includes("indicacao") || src.includes("referral")) canal = "Indicação";
        else if (src.includes("site") || src.includes("web") || src.includes("landing")) canal = "Site/Landing Page";
        else if (src.includes("organic") || src.includes("orgânico") || src.includes("organico")) canal = "Orgânico";
        else if (src && src !== "desconhecido") canal = src;
        else canal = "Não identificado";
      }
      updateData.canal_aquisicao = canal;
      if (attr.utm_source) updateData.utm_source = attr.utm_source;
      if (attr.utm_medium) updateData.utm_medium = attr.utm_medium;
      if (attr.session_source) updateData.session_source = attr.session_source;
      if (attr.ctwa_clid) updateData.ctwa_clid = attr.ctwa_clid;
      stats.canal_identificado++;
    }

    if (Object.keys(updateData).length > 0) {
      await supabase.from("leads_crm").update(updateData).eq("ghl_opportunity_id", lead.ghl_opportunity_id);
    }
  }

  // Contar leads que ficaram sem nada
  stats.sem_canal = leadsSemAd.length - stats.ad_id_encontrado - stats.canal_identificado;

  // 5. Recalcular Ad Intelligence com todos os leads que têm ad_id
  const { data: leadsWithAd } = await supabase
    .from("leads_crm")
    .select("ghl_contact_id, ad_id, adset_id, campaign_id, ad_name, etapa, valor_total_projeto, nome, ghl_created_at")
    .not("ad_id", "is", null)
    .neq("ad_id", "");

  if (leadsWithAd && leadsWithAd.length > 0) {
    // Garantir ads_metadata existe
    const uniqueAdIds = Array.from(new Set(leadsWithAd.map((l) => l.ad_id)));
    const { data: existingAds } = await supabase.from("ads_metadata").select("ad_id").in("ad_id", uniqueAdIds);
    const existingSet = new Set((existingAds || []).map((a) => a.ad_id));
    for (const lead of leadsWithAd) {
      if (!existingSet.has(lead.ad_id)) {
        await supabase.from("ads_metadata").upsert({
          ad_id: lead.ad_id, ad_name: lead.ad_name || `Ad ${lead.ad_id}`,
          adset_id: lead.adset_id || null, campaign_id: lead.campaign_id || null,
          status: "ACTIVE", updated_at: new Date().toISOString(),
        }, { onConflict: "ad_id" });
        existingSet.add(lead.ad_id);
      }
    }

    // Popular leads_ads_attribution
    // created_at recebe o ghl_created_at do lead para que os filtros de
    // período no dashboard reflitam a data REAL da oportunidade no GHL
    // (e não a data em que o enrich rodou).
    for (const lead of leadsWithAd) {
      const leadDate = new Date(lead.ghl_created_at || new Date().toISOString());
      await supabase.from("leads_ads_attribution").upsert({
        lead_id: lead.ghl_contact_id, ad_id: lead.ad_id,
        adset_id: lead.adset_id || null, campaign_id: lead.campaign_id || null,
        nome_lead: lead.nome, estagio_crm: lead.etapa,
        estagio_atualizado_em: new Date().toISOString(),
        receita_gerada: (lead.etapa === "comprou" || lead.etapa === "assinatura_contrato") ? (lead.valor_total_projeto || 0) : 0,
        created_at: lead.ghl_created_at || new Date().toISOString(),
        hora_chegada: leadDate.getHours(),
        dia_semana: leadDate.getDay(),
      }, { onConflict: "lead_id" });
    }

    // Gerar eventos do funil
    await supabase.from("lead_funnel_events").delete().eq("notes", "auto_crm_sync");
    const events: { lead_id: string; ad_id: string; event_type: string; mrr_value: number; notes: string }[] = [];
    for (const lead of leadsWithAd) {
      for (const evt of (ETAPA_TO_EVENTS[lead.etapa] || ["entrada"])) {
        events.push({
          lead_id: lead.ghl_contact_id, ad_id: lead.ad_id, event_type: evt,
          mrr_value: evt === "contrato_fechado" ? (lead.valor_total_projeto || 0) : 0,
          notes: "auto_crm_sync",
        });
      }
    }
    for (let i = 0; i < events.length; i += 500) {
      await supabase.from("lead_funnel_events").insert(events.slice(i, i + 500));
    }

    // Calcular creative_scores
    type AdData = { ad_name: string | null; adset_id: string | null; campaign_id: string | null; events: string[]; mrr: number };
    const adMap = new Map<string, AdData>();
    for (const lead of leadsWithAd) {
      const evts = ETAPA_TO_EVENTS[lead.etapa] || ["entrada"];
      const existing: AdData = adMap.get(lead.ad_id) || { ad_name: lead.ad_name, adset_id: lead.adset_id, campaign_id: lead.campaign_id, events: [] as string[], mrr: 0 };
      existing.events.push(...evts);
      if (evts.includes("contrato_fechado")) existing.mrr += lead.valor_total_projeto || 0;
      if (!existing.ad_name && lead.ad_name) existing.ad_name = lead.ad_name;
      if (!existing.adset_id && lead.adset_id) existing.adset_id = lead.adset_id;
      if (!existing.campaign_id && lead.campaign_id) existing.campaign_id = lead.campaign_id;
      adMap.set(lead.ad_id, existing);
    }

    const adIds = Array.from(adMap.keys());
    const { data: perfData } = await supabase.from("ads_performance").select("ad_id, spend").in("ad_id", adIds);
    const spendByAd = new Map<string, number>();
    for (const r of perfData || []) spendByAd.set(r.ad_id, (spendByAd.get(r.ad_id) || 0) + Number(r.spend));

    const { data: metaData } = await supabase.from("ads_metadata").select("ad_id, ad_name, campaign_id, campaign_name, adset_id, adset_name").in("ad_id", adIds);
    const metaByAd = new Map<string, { ad_name: string; campaign_id: string; campaign_name: string; adset_id: string; adset_name: string }>();
    for (const m of metaData || []) metaByAd.set(m.ad_id, m);

    for (const [adId, data] of Array.from(adMap.entries())) {
      const count = (t: string) => data.events.filter((e) => e === t).length;
      const spend = spendByAd.get(adId) || 0;
      const meta = metaByAd.get(adId);
      const { composite_score, alert_status, alert_message } = calculateCompositeScore({
        total_leads: count("entrada"), qualified_leads: count("qualificado"),
        meetings_scheduled: count("reuniao_agendada"), meetings_held: count("reuniao_realizada"),
        contracts_closed: count("contrato_fechado"), no_shows: count("no_show"),
      });
      const { error } = await supabase.from("creative_scores").upsert({
        ad_id: adId, ad_name: meta?.ad_name || data.ad_name || null,
        campaign_id: meta?.campaign_id || data.campaign_id || null, campaign_name: meta?.campaign_name || null,
        adset_id: meta?.adset_id || data.adset_id || null, adset_name: meta?.adset_name || null,
        total_leads: count("entrada"), qualified_leads: count("qualificado"), disqualified_leads: count("desqualificado"),
        meetings_scheduled: count("reuniao_agendada"), meetings_held: count("reuniao_realizada"),
        no_shows: count("no_show"), proposals_sent: count("proposta_enviada"), contracts_closed: count("contrato_fechado"),
        total_mrr: data.mrr, spend, composite_score, alert_status, alert_message,
        last_updated: new Date().toISOString(),
      }, { onConflict: "ad_id" });
      if (!error) stats.criativos++;
    }

    // Calcular audience_performance
    const adsetMap = new Map<string, { adset_name: string | null; campaign_id: string | null; campaign_name: string | null; events: string[]; mrr: number; adIds: Set<string> }>();
    for (const [adId, data] of Array.from(adMap.entries())) {
      const adsetId = metaByAd.get(adId)?.adset_id || data.adset_id;
      if (!adsetId) continue;
      const existing = adsetMap.get(adsetId) || { adset_name: metaByAd.get(adId)?.adset_name || null, campaign_id: data.campaign_id, campaign_name: metaByAd.get(adId)?.campaign_name || null, events: [], mrr: 0, adIds: new Set<string>() };
      existing.events.push(...data.events);
      existing.mrr += data.mrr;
      existing.adIds.add(adId);
      adsetMap.set(adsetId, existing);
    }
    for (const [adsetId, data] of Array.from(adsetMap.entries())) {
      const count = (t: string) => data.events.filter((e) => e === t).length;
      const spend = Array.from(data.adIds).reduce((s, id) => s + (spendByAd.get(id) || 0), 0);
      const { composite_score, alert_status } = calculateCompositeScore({
        total_leads: count("entrada"), qualified_leads: count("qualificado"),
        meetings_scheduled: count("reuniao_agendada"), meetings_held: count("reuniao_realizada"),
        contracts_closed: count("contrato_fechado"), no_shows: count("no_show"),
      });
      const { error } = await supabase.from("audience_performance").upsert({
        adset_id: adsetId, adset_name: data.adset_name, campaign_id: data.campaign_id, campaign_name: data.campaign_name,
        total_leads: count("entrada"), qualified_leads: count("qualificado"), meetings: count("reuniao_realizada"),
        contracts: count("contrato_fechado"), total_mrr: data.mrr, spend, composite_score, alert_status,
        last_updated: new Date().toISOString(),
      }, { onConflict: "adset_id" });
      if (!error) stats.audiencias++;
    }
  }

  return NextResponse.json({ ...stats, duration_ms: Date.now() - startTime });
}
