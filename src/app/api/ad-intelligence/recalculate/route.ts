/**
 * POST /api/ad-intelligence/recalculate
 * Recalcula creative_scores e audience_performance
 * a partir dos dados reais do CRM (leads_crm com ad_id).
 *
 * Fluxo:
 * 1. Lê todos os leads com ad_id de leads_crm
 * 2. Converte estágio CRM → eventos do funil (lead_funnel_events)
 * 3. Agrupa por ad_id e recalcula creative_scores
 * 4. Agrupa por adset_id e recalcula audience_performance
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateCompositeScore } from "@/lib/traffic/score-calculator";
import { verifySession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

// Mapeamento: estágio CRM → eventos do funil que já foram atingidos
// Um lead em "reuniao_feita" implica que passou por entrada, qualificado, reuniao_agendada, reuniao_realizada
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

interface LeadCRM {
  ghl_contact_id: string;
  ad_id: string;
  adset_id: string | null;
  campaign_id: string | null;
  ad_name: string | null;
  etapa: string;
  valor_total_projeto: number | null;
  nome: string;
  ghl_created_at: string | null;
}

export async function POST() {
  const { error: authError } = await verifySession();
  if (authError) return authError;

  const startTime = Date.now();

  // 1. Buscar todos os leads com ad_id do CRM
  const { data: leads, error: leadsErr } = await supabase
    .from("leads_crm")
    .select("ghl_contact_id, ad_id, adset_id, campaign_id, ad_name, etapa, valor_total_projeto, nome, ghl_created_at")
    .not("ad_id", "is", null)
    .neq("ad_id", "");

  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 });
  if (!leads || leads.length === 0) {
    return NextResponse.json({ message: "Nenhum lead com ad_id encontrado", leads: 0, scores: 0, duration_ms: Date.now() - startTime });
  }

  const typedLeads = leads as LeadCRM[];

  // 2. Garantir que ads_metadata existe para todos os ad_ids (FK requirement)
  const uniqueAdIds = Array.from(new Set(typedLeads.map((l) => l.ad_id)));
  const { data: existingAds } = await supabase
    .from("ads_metadata")
    .select("ad_id")
    .in("ad_id", uniqueAdIds);
  const existingAdSet = new Set((existingAds || []).map((a) => a.ad_id));

  let adsCreated = 0;
  for (const lead of typedLeads) {
    if (!existingAdSet.has(lead.ad_id)) {
      await supabase.from("ads_metadata").upsert({
        ad_id: lead.ad_id,
        ad_name: lead.ad_name || `Ad ${lead.ad_id}`,
        adset_id: lead.adset_id || null,
        campaign_id: lead.campaign_id || null,
        status: "ACTIVE",
        updated_at: new Date().toISOString(),
      }, { onConflict: "ad_id" });
      existingAdSet.add(lead.ad_id);
      adsCreated++;
    }
  }

  // 3. Popular leads_ads_attribution diretamente (não depender do trigger)
  let attrUpserted = 0;
  for (const lead of typedLeads) {
    const estagioCrm = lead.etapa === "comprou" || lead.etapa === "assinatura_contrato"
      ? lead.etapa : lead.etapa;
    const leadDate = new Date(lead.ghl_created_at || new Date().toISOString());
    const { error: attrErr } = await supabase.from("leads_ads_attribution").upsert({
      lead_id: lead.ghl_contact_id,
      ad_id: lead.ad_id,
      adset_id: lead.adset_id || null,
      campaign_id: lead.campaign_id || null,
      nome_lead: lead.nome,
      estagio_crm: estagioCrm,
      estagio_atualizado_em: new Date().toISOString(),
      receita_gerada: (lead.etapa === "comprou" || lead.etapa === "assinatura_contrato")
        ? (lead.valor_total_projeto || 0) : 0,
      created_at: lead.ghl_created_at || new Date().toISOString(),
      hora_chegada: leadDate.getHours(),
      dia_semana: leadDate.getDay(),
    }, { onConflict: "lead_id" });
    if (!attrErr) attrUpserted++;
  }

  // 4. Limpar eventos antigos gerados automaticamente e recriar
  await supabase
    .from("lead_funnel_events")
    .delete()
    .eq("notes", "auto_crm_sync");

  // 5. Gerar eventos do funil baseados no estágio CRM
  const eventsToInsert: {
    lead_id: string; ad_id: string; event_type: string;
    mrr_value: number; notes: string;
  }[] = [];

  for (const lead of typedLeads) {
    const events = ETAPA_TO_EVENTS[lead.etapa] || ["entrada"];
    for (const eventType of events) {
      const mrrValue = eventType === "contrato_fechado" ? (lead.valor_total_projeto || 0) : 0;
      eventsToInsert.push({
        lead_id: lead.ghl_contact_id,
        ad_id: lead.ad_id,
        event_type: eventType,
        mrr_value: mrrValue,
        notes: "auto_crm_sync",
      });
    }
  }

  // Inserir em batches de 500
  let eventsInserted = 0;
  for (let i = 0; i < eventsToInsert.length; i += 500) {
    const batch = eventsToInsert.slice(i, i + 500);
    const { error: insertErr } = await supabase.from("lead_funnel_events").insert(batch);
    if (!insertErr) eventsInserted += batch.length;
  }

  // 4. Agrupar por ad_id e recalcular creative_scores
  const adMap = new Map<string, {
    ad_name: string | null; adset_id: string | null; campaign_id: string | null;
    events: string[]; mrr: number;
  }>();

  for (const lead of typedLeads) {
    const events = ETAPA_TO_EVENTS[lead.etapa] || ["entrada"];
    const existing = adMap.get(lead.ad_id) || {
      ad_name: lead.ad_name, adset_id: lead.adset_id, campaign_id: lead.campaign_id,
      events: [], mrr: 0,
    };
    existing.events.push(...events);
    if (events.includes("contrato_fechado")) {
      existing.mrr += lead.valor_total_projeto || 0;
    }
    // Preencher campos que podem estar null
    if (!existing.ad_name && lead.ad_name) existing.ad_name = lead.ad_name;
    if (!existing.adset_id && lead.adset_id) existing.adset_id = lead.adset_id;
    if (!existing.campaign_id && lead.campaign_id) existing.campaign_id = lead.campaign_id;
    adMap.set(lead.ad_id, existing);
  }

  // Buscar spend e metadata do Meta
  const adIds = Array.from(adMap.keys());
  const { data: perfData } = await supabase
    .from("ads_performance")
    .select("ad_id, spend")
    .in("ad_id", adIds);
  const spendByAd = new Map<string, number>();
  for (const r of perfData || []) {
    spendByAd.set(r.ad_id, (spendByAd.get(r.ad_id) || 0) + Number(r.spend));
  }

  const { data: metaData } = await supabase
    .from("ads_metadata")
    .select("ad_id, ad_name, campaign_id, campaign_name, adset_id, adset_name")
    .in("ad_id", adIds);
  const metaByAd = new Map<string, { ad_name: string; campaign_id: string; campaign_name: string; adset_id: string; adset_name: string }>();
  for (const m of metaData || []) {
    metaByAd.set(m.ad_id, m);
  }

  // Calcular scores e upsert
  let scoresUpdated = 0;
  for (const [adId, data] of Array.from(adMap.entries())) {
    const count = (type: string) => data.events.filter((e) => e === type).length;
    const total_leads = count("entrada");
    const qualified_leads = count("qualificado");
    const disqualified_leads = count("desqualificado");
    const meetings_scheduled = count("reuniao_agendada");
    const meetings_held = count("reuniao_realizada");
    const no_shows = count("no_show");
    const proposals_sent = count("proposta_enviada");
    const contracts_closed = count("contrato_fechado");

    const spend = spendByAd.get(adId) || 0;
    const meta = metaByAd.get(adId);

    const { composite_score, alert_status, alert_message } = calculateCompositeScore({
      total_leads, qualified_leads, meetings_scheduled,
      meetings_held, contracts_closed, no_shows,
    });

    const { error } = await supabase.from("creative_scores").upsert({
      ad_id: adId,
      ad_name: meta?.ad_name || data.ad_name || null,
      campaign_id: meta?.campaign_id || data.campaign_id || null,
      campaign_name: meta?.campaign_name || null,
      adset_id: meta?.adset_id || data.adset_id || null,
      adset_name: meta?.adset_name || null,
      total_leads, qualified_leads, disqualified_leads,
      meetings_scheduled, meetings_held, no_shows,
      proposals_sent, contracts_closed,
      total_mrr: data.mrr, spend,
      composite_score, alert_status, alert_message,
      last_updated: new Date().toISOString(),
    }, { onConflict: "ad_id" });

    if (!error) scoresUpdated++;
  }

  // 5. Recalcular audience_performance agrupando por adset_id
  const adsetMap = new Map<string, {
    adset_name: string | null; campaign_id: string | null; campaign_name: string | null;
    events: string[]; mrr: number; adIds: Set<string>;
  }>();

  for (const [adId, data] of Array.from(adMap.entries())) {
    const adsetId = metaByAd.get(adId)?.adset_id || data.adset_id;
    if (!adsetId) continue;

    const existing = adsetMap.get(adsetId) || {
      adset_name: metaByAd.get(adId)?.adset_name || null,
      campaign_id: metaByAd.get(adId)?.campaign_id || data.campaign_id || null,
      campaign_name: metaByAd.get(adId)?.campaign_name || null,
      events: [], mrr: 0, adIds: new Set<string>(),
    };
    existing.events.push(...data.events);
    existing.mrr += data.mrr;
    existing.adIds.add(adId);
    adsetMap.set(adsetId, existing);
  }

  let audiencesUpdated = 0;
  for (const [adsetId, data] of Array.from(adsetMap.entries())) {
    const count = (type: string) => data.events.filter((e) => e === type).length;
    const total_leads = count("entrada");
    const qualified_leads = count("qualificado");
    const meetings = count("reuniao_realizada");
    const contracts = count("contrato_fechado");

    const adIdsArr = Array.from(data.adIds);
    const spend = adIdsArr.reduce((s, id) => s + (spendByAd.get(id) || 0), 0);

    const { composite_score, alert_status } = calculateCompositeScore({
      total_leads, qualified_leads,
      meetings_scheduled: count("reuniao_agendada"),
      meetings_held: meetings,
      contracts_closed: contracts,
      no_shows: count("no_show"),
    });

    const { error } = await supabase.from("audience_performance").upsert({
      adset_id: adsetId,
      adset_name: data.adset_name,
      campaign_id: data.campaign_id,
      campaign_name: data.campaign_name,
      total_leads, qualified_leads, meetings, contracts,
      total_mrr: data.mrr, spend, composite_score, alert_status,
      last_updated: new Date().toISOString(),
    }, { onConflict: "adset_id" });

    if (!error) audiencesUpdated++;
  }

  return NextResponse.json({
    leads_com_ad_id: typedLeads.length,
    ads_metadata_criados: adsCreated,
    leads_atribuidos: attrUpserted,
    eventos_gerados: eventsInserted,
    criativos_atualizados: scoresUpdated,
    audiencias_atualizadas: audiencesUpdated,
    duration_ms: Date.now() - startTime,
  });
}
