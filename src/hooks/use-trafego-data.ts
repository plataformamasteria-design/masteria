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

            const [{ data: m }, { data: p }, { data: l }, { data: pp }, { data: pl }, { data: al }, metaInsights] = await Promise.all([
                metaQuery,
                supabase.from("ads_performance").select("*").gte("data_ref", dataInicio).lte("data_ref", dataFim).order("data_ref").limit(10000),
                supabase.from("leads_ads_attribution").select("*").gte("created_at", leadsStart).lte("created_at", dataFim + "T23:59:59").limit(5000),
                supabase.from("ads_performance").select("*").gte("data_ref", pi).lte("data_ref", pf).order("data_ref").limit(10000),
                supabase.from("leads_ads_attribution").select("*").gte("created_at", prevLeadsStart).lte("created_at", pf + "T23:59:59").limit(5000),
                supabase.from("vw_atribuicao_lead_mes").select("lead_id, ad_id, adset_id, campanha_id, campanha_nome, foi_qualificado, teve_reuniao_agendada, teve_reuniao_realizada, foi_no_show, virou_cliente, mrr_gerado, closer_id, mes_lead").in("mes_lead", mesesRef).limit(10000),
                // Meta API: spend real por campanha (corrige ads_performance stale)
                fetch(`/api/meta/insights?since=${dataInicio}&until=${dataFim}&level=campaign&breakdown=none`).then(r => r.ok ? r.json() : null).catch(() => null),
            ]);

            // Corrigir spend do ads_performance com valores reais da Meta API
            let perfData = (p || []) as AdsPerformance[];
            if (metaInsights?.data) {
                // Map: campaign_id → spend real da Meta API
                const metaSpendByCampaign = new Map<string, number>();
                for (const row of metaInsights.data) {
                    if (row.campaign_id && row.spend > 0) {
                        metaSpendByCampaign.set(row.campaign_id, row.spend);
                    }
                }
                // Map: campaign_id → spend total no banco (para calcular fator de correção)
                const metaMap = new Map<string, string>();
                for (const meta of (m || [])) {
                    if (meta.ad_id && meta.campaign_id) metaMap.set(meta.ad_id, meta.campaign_id);
                }
                const dbSpendByCampaign = new Map<string, number>();
                for (const perf of perfData) {
                    const cid = metaMap.get(perf.ad_id);
                    if (cid) dbSpendByCampaign.set(cid, (dbSpendByCampaign.get(cid) || 0) + Number(perf.spend));
                }
                // Aplicar fator de correção proporcional por ad dentro de cada campanha
                perfData = perfData.map(perf => {
                    const cid = metaMap.get(perf.ad_id);
                    if (!cid) return perf;
                    const metaTotal = metaSpendByCampaign.get(cid);
                    const dbTotal = dbSpendByCampaign.get(cid);
                    if (!metaTotal || !dbTotal || dbTotal === 0) return perf;
                    const fator = metaTotal / dbTotal;
                    if (Math.abs(fator - 1) < 0.005) return perf; // Diferença < 0.5% — não ajustar
                    return { ...perf, spend: Number(perf.spend) * fator };
                });
            }

            return {
                metadata: (m || []) as AdsMetadata[],
                performance: perfData,
                leads: (l || []) as LeadAdsAttribution[],
                prevPerformance: (pp || []) as AdsPerformance[],
                prevLeads: (pl || []) as LeadAdsAttribution[],
                attrStartIso,
                attrLeads: (al || []) as AttrLead[],
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

