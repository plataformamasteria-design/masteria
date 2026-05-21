"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { AdsMetadata, AdsPerformance, LeadAdsAttribution } from "@/types/database";

export interface AttrLead {
    lead_id: string;
    ad_id: string | null;
    adset_id: string | null;
    campanha_id: string | null;
    campanha_nome: string | null;
    foi_qualificado: boolean;
    teve_reuniao_agendada: boolean;
    teve_reuniao_realizada: boolean;
    foi_no_show: boolean;
    virou_cliente: boolean;
    mrr_gerado: number | null;
    closer_id: string | null;
    mes_lead: string | null;
}

export interface TrafegoData {
    metadata: AdsMetadata[];
    performance: AdsPerformance[];
    leads: LeadAdsAttribution[];
    prevPerformance: AdsPerformance[];
    prevLeads: LeadAdsAttribution[];
    attrStartIso: string;
    /** Leads da view canônica vw_atribuicao_lead_mes (qualificação correta) */
    attrLeads: AttrLead[];
    liveCampanhas?: any[];
}

export function useTrafegoData(dataInicio: string, dataFim: string, statusFiltro: string) {
    const swr = useSWR<TrafegoData>(
        ["trafego-data", dataInicio, dataFim, statusFiltro],
        async () => {
            let metaQuery = supabase.from("ads_metadata").select("*").limit(5000);
            if (statusFiltro !== "all") metaQuery = metaQuery.eq("status", statusFiltro);

            const attrRes = await fetch("/api/marketing/attribution-start").then((r) => r.json()).catch(() => null);
            const attrStartIso: string = attrRes?.attribution_start || "2026-04-03T23:21:18.000Z";

            const inicio = new Date(dataInicio + "T00:00:00");
            const fim = new Date(dataFim + "T23:59:59");
            const dias = Math.ceil((fim.getTime() - inicio.getTime()) / 86400000);
            const prevFimDate = new Date(inicio); prevFimDate.setDate(prevFimDate.getDate() - 1);
            const prevInicioDate = new Date(prevFimDate); prevInicioDate.setDate(prevInicioDate.getDate() - dias);
            const pi = `${prevInicioDate.getFullYear()}-${String(prevInicioDate.getMonth() + 1).padStart(2, "0")}-${String(prevInicioDate.getDate()).padStart(2, "0")}`;
            const pf = `${prevFimDate.getFullYear()}-${String(prevFimDate.getMonth() + 1).padStart(2, "0")}-${String(prevFimDate.getDate()).padStart(2, "0")}`;

            const filtroInicioIso = dataInicio + "T00:00:00.000Z";
            const leadsStart = filtroInicioIso > attrStartIso ? filtroInicioIso : attrStartIso;
            const prevLeadsStart = (pi + "T00:00:00.000Z") > attrStartIso ? (pi + "T00:00:00.000Z") : attrStartIso;

            // Derivar meses cobertos pelo range (para vw_atribuicao_lead_mes)
            const mesesRef: string[] = [];
            const curDate = new Date(dataInicio + "T00:00:00");
            const fimDate = new Date(dataFim + "T00:00:00");
            while (curDate <= fimDate) {
                mesesRef.push(`${curDate.getFullYear()}-${String(curDate.getMonth() + 1).padStart(2, "0")}`);
                curDate.setMonth(curDate.getMonth() + 1);
            }

            const [{ data: m }, { data: l }, { data: pl }, { data: al }, liveCampanhas, prevLiveCampanhas, liveInsights, prevLiveInsights] = await Promise.all([
                metaQuery,
                supabase.from("leads_ads_attribution").select("*").gte("created_at", leadsStart).lte("created_at", dataFim + "T23:59:59").limit(5000),
                supabase.from("leads_ads_attribution").select("*").gte("created_at", prevLeadsStart).lte("created_at", pf + "T23:59:59").limit(5000),
                supabase.from("vw_atribuicao_lead_mes").select("lead_id, ad_id, adset_id, campanha_id, campanha_nome, foi_qualificado, teve_reuniao_agendada, teve_reuniao_realizada, foi_no_show, virou_cliente, mrr_gerado, closer_id, mes_lead").in("mes_lead", mesesRef).limit(10000),
                // Live Meta API (replaces stale ads_performance)
                fetch(`/api/meta/campanhas?since=${dataInicio}&until=${dataFim}`).then(r => r.ok ? r.json() : null).catch(() => null),
                fetch(`/api/meta/campanhas?since=${pi}&until=${pf}`).then(r => r.ok ? r.json() : null).catch(() => null),
                fetch(`/api/meta/insights?since=${dataInicio}&until=${dataFim}&level=ad`).then(r => r.ok ? r.json() : null).catch(() => null),
                fetch(`/api/meta/insights?since=${pi}&until=${pf}&level=ad`).then(r => r.ok ? r.json() : null).catch(() => null),
            ]);

            const perfData: AdsPerformance[] = [];
            const prevPerfData: AdsPerformance[] = [];
            const mappedMetadata = (m || []) as AdsMetadata[];
            const existingAdIds = new Set(mappedMetadata.map(row => row.ad_id));
            const metaOverride = new Map<string, any>();

            // 1. Traverse campaigns to get objectives and budgets
            const traverseTree = (camps: any[], isPrev: boolean) => {
                for (const c of camps) {
                    if (!isPrev) {
                        metaOverride.set(c.id, {
                            status: c.effective_status || c.status,
                            objetivo: c.objective,
                            campaign_name: c.name,
                            daily_budget: c.daily_budget,
                            spend: c.spend
                        });
                    }
                    for (const as of c.adsets?.data || []) {
                        if (!isPrev) {
                            metaOverride.set(as.id, {
                                status: as.effective_status || as.status,
                                adset_name: as.name,
                                daily_budget: as.daily_budget,
                                campaign_id: c.id,
                                campaign_name: c.name,
                                objetivo: c.objective
                            });
                        }
                    }
                }
            };

            if (liveCampanhas?.data) traverseTree(liveCampanhas.data, false);
            if (prevLiveCampanhas?.data) traverseTree(prevLiveCampanhas.data, true);

            // 2. Map actual ad-level performance from insights
            const mapInsights = (insights: any[], isPrev: boolean) => {
                const targetPerf = isPrev ? prevPerfData : perfData;
                const refDate = isPrev ? pi : dataInicio;
                
                for (const ad of insights) {
                    if (!isPrev) {
                        // Inject ad into metadata if it doesn't exist
                        if (!existingAdIds.has(ad.id)) {
                            const campOver = metaOverride.get(ad.parent_id || "") || {};
                            mappedMetadata.push({
                                ad_id: ad.id,
                                ad_name: ad.name,
                                adset_id: ad.parent_id,
                                adset_name: campOver.adset_name || "Unknown",
                                campaign_id: campOver.campaign_id,
                                campaign_name: campOver.campaign_name || "Unknown",
                                objetivo: campOver.objetivo || "CONVERSIONS",
                                status: ad.status || "ACTIVE",
                                updated_at: new Date().toISOString(),
                            });
                            existingAdIds.add(ad.id);
                        }
                    }
                    
                    targetPerf.push({
                        id: ad.id + (isPrev ? "_prev" : "_curr"),
                        ad_id: ad.id,
                        data_ref: refDate,
                        spend: ad.spend || 0,
                        leads: ad.leads || 0,
                        impressoes: ad.impressions || 0,
                        cliques: ad.clicks || 0,
                        cpl: ad.cpl || 0,
                        ctr: ad.ctr || 0,
                        cpc: ad.clicks > 0 ? ad.spend / ad.clicks : 0,
                        frequencia: ad.frequency || 0,
                        created_at: new Date().toISOString(),
                    });
                }
            };

            if (liveInsights?.data) mapInsights(liveInsights.data, false);
            if (prevLiveInsights?.data) mapInsights(prevLiveInsights.data, true);

            // Apply overrides
            const finalMetadata = mappedMetadata.map(row => {
                const adOver = metaOverride.get(row.ad_id) || {};
                const campOver = metaOverride.get(row.campaign_id || "") || {};
                return {
                    ...row,
                    status: adOver.status || campOver.status || row.status,
                    objetivo: adOver.objetivo || campOver.objetivo || row.objetivo,
                    campaign_name: campOver.campaign_name || row.campaign_name,
                    ad_name: adOver.ad_name || row.ad_name,
                    daily_budget: campOver.daily_budget
                };
            });

            return {
                metadata: finalMetadata as AdsMetadata[],
                performance: perfData,
                leads: (l || []) as LeadAdsAttribution[],
                prevPerformance: prevPerfData,
                prevLeads: (pl || []) as LeadAdsAttribution[],
                attrStartIso,
                attrLeads: (al || []) as AttrLead[],
                liveCampanhas: liveCampanhas?.data || [],
            };
        },
        {
            revalidateOnFocus: false,
            dedupingInterval: 30000,
            keepPreviousData: true
        }
    );

    // Listen for global sync events to revalidate
    useEffect(() => {
        const handler = () => swr.mutate();
        window.addEventListener("comarka-sync-done", handler);
        return () => window.removeEventListener("comarka-sync-done", handler);
    }, [swr.mutate]);

    return swr;
}

