/**
 * Propagação centralizada de AD ID.
 *
 * Ao atribuir um ad_id a um lead, esta função garante que:
 * 1. leads_crm recebe ad_id, campaign_id, adset_id, ad_name
 * 2. leads_ads_attribution recebe um registro (upsert) com os mesmos dados
 * 3. ads_metadata é consultado para enriquecer os dados
 *
 * Regras:
 * - Idempotente: pode ser chamada N vezes sem efeito colateral
 * - Nunca sobrescreve ad_id existente com null/vazio
 * - mes_referencia nunca é alterado
 */

import { supabase } from "@/lib/supabase";

export interface PropagateResult {
  ok: boolean;
  enriched: boolean;
  error?: string;
}

/**
 * Propaga ad_id para leads_crm + leads_ads_attribution + enriquece com ads_metadata.
 * Client-side (usa supabase anon client).
 */
export async function propagateAdId(leadId: string, adId: string): Promise<PropagateResult> {
  if (!leadId || !adId || !adId.trim()) {
    return { ok: false, enriched: false, error: "leadId e adId são obrigatórios" };
  }

  const trimmedAdId = adId.trim();

  try {
    // 1. Buscar dados do lead atual (para não sobrescrever ad_id existente com null)
    const { data: lead } = await supabase
      .from("leads_crm")
      .select("id, ad_id, ghl_contact_id, nome, telefone, email, etapa, mes_referencia, ghl_created_at, valor_total_projeto")
      .eq("id", leadId)
      .single();

    if (!lead) {
      return { ok: false, enriched: false, error: "Lead não encontrado" };
    }

    // 2. Buscar enriquecimento do ads_metadata
    const { data: meta } = await supabase
      .from("ads_metadata")
      .select("campaign_id, adset_id, ad_name, campaign_name, adset_name")
      .eq("ad_id", trimmedAdId)
      .single();

    // 3. Atualizar leads_crm (nunca toca mes_referencia)
    const crmUpdate: Record<string, unknown> = {
      ad_id: trimmedAdId,
      origem_tipo: "meta_ads_manual",
      atribuicao_tier: 3,
    };
    if (meta?.campaign_id) crmUpdate.campaign_id = meta.campaign_id;
    if (meta?.adset_id) crmUpdate.adset_id = meta.adset_id;
    if (meta?.ad_name) crmUpdate.ad_name = meta.ad_name;
    if (meta?.campaign_name) crmUpdate.campaign_name = meta.campaign_name;
    if (meta?.adset_name) crmUpdate.adset_name = meta.adset_name;
    // Se tem metadata confirmada, promover para tier 1 (exato)
    if (meta) {
      crmUpdate.origem_tipo = "meta_ads_automatico";
      crmUpdate.atribuicao_tier = 1;
    }

    const { error: crmErr } = await supabase
      .from("leads_crm")
      .update(crmUpdate)
      .eq("id", leadId);

    if (crmErr) {
      return { ok: false, enriched: false, error: `Erro ao atualizar leads_crm: ${crmErr.message}` };
    }

    // 4. Upsert em leads_ads_attribution
    const attrRecord: Record<string, unknown> = {
      lead_id: lead.ghl_contact_id || leadId,
      ad_id: trimmedAdId,
      adset_id: meta?.adset_id || null,
      campaign_id: meta?.campaign_id || null,
      nome_lead: lead.nome || null,
      telefone: lead.telefone || null,
      email: lead.email || null,
      estagio_crm: lead.etapa,
      estagio_atualizado_em: new Date().toISOString(),
      receita_gerada: (lead.etapa === "comprou" || lead.etapa === "assinatura_contrato")
        ? Number(lead.valor_total_projeto || 0) : 0,
      created_at: lead.ghl_created_at || new Date().toISOString(),
    };

    const { error: attrErr } = await supabase
      .from("leads_ads_attribution")
      .upsert(attrRecord, { onConflict: "lead_id" });

    if (attrErr) {
      // Não falha a operação toda — leads_crm já foi atualizado
      console.error("Erro ao upsert leads_ads_attribution:", attrErr.message);
    }

    // 5. Disparar evento para invalidar caches do Ad Intelligence
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ad-attribution-updated", {
        detail: { leadId, adId: trimmedAdId },
      }));
    }

    return { ok: true, enriched: !!meta };
  } catch (e) {
    return { ok: false, enriched: false, error: String(e) };
  }
}

/**
 * Opções extras para enriquecer o lead além do ad_id.
 */
export interface PropagateOptions {
  /** Se true, seta canal_aquisicao = 'Trafego Pago' e funil = 'Formulario' */
  isMetaForm?: boolean;
  /** IDs já conhecidos (evita re-lookup no ads_metadata) */
  campaign_id?: string;
  adset_id?: string;
  /** Tier explícito (default: 1 se enriquecido, 3 se não) */
  tier?: number;
  /** meta_form_leads.id para marcar como matched */
  metaFormLeadId?: string;
}

/**
 * Versão server-side (usa service role key).
 * Para uso em API routes e cron jobs.
 *
 * Enriquece com nomes de campanha/conjunto/anúncio do ads_metadata,
 * seta canal_aquisicao/funil/origem_tipo, e atualiza meta_form_leads.
 */
export async function propagateAdIdServer(
  supabaseAdmin: { from: (table: string) => any },
  leadId: string,
  adId: string,
  options: PropagateOptions = {}
): Promise<PropagateResult> {
  if (!leadId || !adId || !adId.trim()) {
    return { ok: false, enriched: false, error: "leadId e adId são obrigatórios" };
  }

  const trimmedAdId = adId.trim();

  try {
    const { data: lead } = await supabaseAdmin
      .from("leads_crm")
      .select("id, ad_id, ghl_contact_id, nome, telefone, email, etapa, ghl_created_at, valor_total_projeto, canal_aquisicao, funil")
      .eq("id", leadId)
      .single();

    if (!lead) {
      return { ok: false, enriched: false, error: "Lead não encontrado" };
    }

    const { data: meta } = await supabaseAdmin
      .from("ads_metadata")
      .select("campaign_id, adset_id, ad_name, campaign_name, adset_name")
      .eq("ad_id", trimmedAdId)
      .single();

    const crmUpdate: Record<string, unknown> = {
      ad_id: trimmedAdId,
      origem_tipo: "meta_ads_manual",
      atribuicao_tier: options.tier ?? 3,
    };

    // Enriquecer com ads_metadata (nomes + IDs)
    if (meta?.campaign_id) crmUpdate.campaign_id = meta.campaign_id;
    if (meta?.adset_id) crmUpdate.adset_id = meta.adset_id;
    if (meta?.ad_name) crmUpdate.ad_name = meta.ad_name;
    if (meta?.campaign_name) crmUpdate.campaign_name = meta.campaign_name;
    if (meta?.adset_name) crmUpdate.adset_name = meta.adset_name;
    if (meta) {
      crmUpdate.origem_tipo = "meta_ads_automatico";
      crmUpdate.atribuicao_tier = options.tier ?? 1;
    }

    // IDs passados explicitamente (fallback se ads_metadata não tiver)
    if (options.campaign_id && !crmUpdate.campaign_id) crmUpdate.campaign_id = options.campaign_id;
    if (options.adset_id && !crmUpdate.adset_id) crmUpdate.adset_id = options.adset_id;

    // Canal e funil para leads de formulário Meta — só setar se vazio/genérico
    // Nunca sobrescrever canal/funil já definidos (ex: "Indicacao", "Sessao Estrategica")
    if (options.isMetaForm) {
      const canalAtual = (lead as any).canal_aquisicao || "";
      const funilAtual = (lead as any).funil || "";
      const canaisGenericos = ["", "Desconhecido", "Organico"];
      if (canaisGenericos.includes(canalAtual)) {
        crmUpdate.canal_aquisicao = "Trafego Pago";
      }
      if (!funilAtual) {
        crmUpdate.funil = "Formulario";
      }
    }

    // Safety: nunca sobrescrever ad_id existente
    if (lead.ad_id && lead.ad_id !== trimmedAdId) {
      // Lead já tem outro ad_id — não sobrescrever, só enriquecer campos faltantes
      delete crmUpdate.ad_id;
      delete crmUpdate.origem_tipo;
      delete crmUpdate.atribuicao_tier;
    }

    await supabaseAdmin.from("leads_crm").update(crmUpdate).eq("id", leadId);

    await supabaseAdmin.from("leads_ads_attribution").upsert({
      lead_id: lead.ghl_contact_id || leadId,
      ad_id: trimmedAdId,
      adset_id: meta?.adset_id || options.adset_id || null,
      campaign_id: meta?.campaign_id || options.campaign_id || null,
      nome_lead: lead.nome || null,
      telefone: lead.telefone || null,
      email: lead.email || null,
      estagio_crm: lead.etapa,
      estagio_atualizado_em: new Date().toISOString(),
      receita_gerada: (lead.etapa === "comprou" || lead.etapa === "assinatura_contrato")
        ? Number(lead.valor_total_projeto || 0) : 0,
      created_at: lead.ghl_created_at || new Date().toISOString(),
    }, { onConflict: "lead_id" });

    // Atualizar meta_form_leads se ID informado
    if (options.metaFormLeadId) {
      await supabaseAdmin
        .from("meta_form_leads")
        .update({ matched_lead_crm_id: leadId, match_status: "matched", matched_at: new Date().toISOString() })
        .eq("id", options.metaFormLeadId);
    }

    return { ok: true, enriched: !!meta };
  } catch (e) {
    return { ok: false, enriched: false, error: String(e) };
  }
}
