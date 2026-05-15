"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { z } from "zod";
import type { AdsMetadata, AdsPerformance, LeadAdsAttribution } from "@/types/database";

/* ==========================================================================
   1. Zod Schemas (Rigor Type-Safety para as APIs do Meta)
   ========================================================================== */
const AudienceItemSchema = z.object({
    tipo: z.enum(["interest", "behavior", "custom_audience", "lookalike"]),
    id: z.string(),
    name: z.string(),
});

const AdSetAudienceSchema = z.object({
    adset_id: z.string(),
    adset_name: z.string(),
    campaign_id: z.string(),
    campaign_name: z.string(),
    status: z.string(),
    age_min: z.number().optional(),
    age_max: z.number().optional(),
    genders: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
    audiences: z.array(AudienceItemSchema),
});

const MetaAudiencesResponseSchema = z.object({
    data: z.array(AdSetAudienceSchema),
    error: z.string().optional(),
});

export type AdSetAudience = z.infer<typeof AdSetAudienceSchema>;
export type AudienceItemType = z.infer<typeof AudienceItemSchema>;

export type AudienceWithPerf = AudienceItemType & {
    adsets: string[];
    campaigns: Set<string>;
    spend: number;
    impressoes: number;
    cliques: number;
    leads: number;
    cpl: number;
    ctr: number;
};

/* ==========================================================================
   2. Engine Principal
   ========================================================================== */
interface AudiencesEngineProps {
    performance: AdsPerformance[];
    metadata: AdsMetadata[];
    statusFiltro: string;
    somenteComDados: boolean;
    tipoFiltro: string;
}

export function useAudiencesEngine({
    performance,
    metadata,
    statusFiltro,
    somenteComDados,
    tipoFiltro,
}: AudiencesEngineProps) {

    // Fetch das audiências cacheadas no background sem bloquear a UI se travar
    const { data: audienceDataRaw, isLoading: loadingAudiences, error } = useSWR(
        "/api/meta-audiences",
        async (url) => {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Falha na API de Públicos");
            const json = await res.json();

            // Validação Zod garantindo consistência estrita dos dados
            const parsed = MetaAudiencesResponseSchema.parse(json);
            return parsed.data || [];
        },
        { revalidateOnFocus: false, dedupingInterval: 60000, keepPreviousData: true }
    );

    const audienceData = audienceDataRaw || [];

    // ========================================================================
    // Core Mapeamento & PROPORTIONAL ATTRIBUTION (Shadow Tracking Pillar 2 e 4)
    // ========================================================================
    const { audienceRows, bucketBroad, stats } = useMemo(() => {
        // 1. Array de Performance Global (Fonte da Verdade)
        const totalGlobalSpend = performance.reduce((s, p) => s + Number(p.spend), 0);
        const totalGlobalLeads = performance.reduce((s, p) => s + p.leads, 0);

        // 2. Mapeamento de ad_id -> adset_id
        const adToAdset = new Map<string, string>();
        for (const m of metadata) {
            if (m.adset_id) adToAdset.set(m.ad_id, m.adset_id);
        }

        // 3. Agregar performance por Adset REAL (usando Performance Table)
        const perfByAdset = new Map<string, { spend: number; impressoes: number; cliques: number; leads: number }>();
        let spendUnmappedAds = 0; // Gastos de anúncios que NÃO tem metadata (ex: deletados que ainda geraram custo no mes)

        for (const p of performance) {
            const adset_id = adToAdset.get(p.ad_id);
            if (!adset_id) {
                spendUnmappedAds += Number(p.spend);
                continue;
            }
            const existing = perfByAdset.get(adset_id) || { spend: 0, impressoes: 0, cliques: 0, leads: 0 };
            existing.spend += Number(p.spend);
            existing.impressoes += p.impressoes;
            existing.cliques += p.cliques;
            existing.leads += p.leads;
            perfByAdset.set(adset_id, existing);
        }

        // 4. Transformar Audiences e aplicar "Proportional Attribution"
        const audienceMap = new Map<string, AudienceWithPerf>();
        let spendMappedToAudiences = 0; // Quantia total de dinheiro que conseguimos "grudar" nos públicos detalhados
        let leadsMappedToAudiences = 0;

        for (const as of audienceData) {
            // Filtrar por status se demandado
            if (statusFiltro !== "all" && as.status !== statusFiltro) continue;

            const adsetPerf = perfByAdset.get(as.adset_id);
            if (!adsetPerf || adsetPerf.spend <= 0) continue; // Sem gastos, não iteramos matemática doida

            const audCount = as.audiences.length;

            // Se o conjunto TEM públicos mapeados, dividimos o gasto nele equitativamente
            if (audCount > 0) {
                // PROPORTIONAL ATTRIBUTION MATH
                const pSpend = adsetPerf.spend / audCount;
                const pImpr = adsetPerf.impressoes / audCount;
                const pClicks = adsetPerf.cliques / audCount;
                const pLeads = adsetPerf.leads / audCount;

                spendMappedToAudiences += adsetPerf.spend; // Somamos o todo (não importa se dividiu em 5)
                leadsMappedToAudiences += adsetPerf.leads;

                for (const aud of as.audiences) {
                    const key = aud.id;
                    if (audienceMap.has(key)) {
                        const existing = audienceMap.get(key)!;
                        existing.spend += pSpend;
                        existing.impressoes += pImpr;
                        existing.cliques += pClicks;
                        existing.leads += pLeads;
                        if (!existing.adsets.includes(as.adset_id)) existing.adsets.push(as.adset_id);
                        existing.campaigns.add(as.campaign_name);
                    } else {
                        audienceMap.set(key, {
                            ...aud,
                            adsets: [as.adset_id],
                            campaigns: new Set([as.campaign_name]),
                            spend: pSpend,
                            impressoes: pImpr,
                            cliques: pClicks,
                            leads: pLeads,
                            cpl: 0,
                            ctr: 0,
                        });
                    }
                }
            }
        }

        // 5. Filtragem secundária da linha e formatação
        const rows = Array.from(audienceMap.values()).map((a) => ({
            ...a,
            cpl: a.leads > 0 ? a.spend / a.leads : 0,
            ctr: a.impressoes > 0 ? (a.cliques / a.impressoes) * 100 : 0,
            campaignNames: Array.from(a.campaigns),
        }));

        const filtered = tipoFiltro === "all" ? rows : rows.filter((a) => a.tipo === tipoFiltro);
        const withData = somenteComDados ? filtered.filter((a) => a.spend > 0) : filtered;

        // 6. CATCH-ALL BUCKET (O resto matemático que 100% garante a fonte da verdade global)
        // Tudo que não foi linkado = Spend Global Total - Spend Mapeado em Públicos (ou ads deletados)
        const missingSpend = Math.max(0, totalGlobalSpend - spendMappedToAudiences);
        const missingLeads = Math.max(0, totalGlobalLeads - leadsMappedToAudiences);

        const bucketBroad = {
            tipo: "broad" as const,
            id: "bucket_broad",
            name: "Broad / Sem Direcionamento Exato",
            spend: missingSpend,
            impressoes: 0,
            cliques: 0,
            leads: missingLeads,
            cpl: missingLeads > 0 ? missingSpend / missingLeads : 0,
            ctr: 0, // CTR impreciso pra bucket genérico
            campaignNames: ["Múltiplas"],
            adsets: ["..."],
        };

        return {
            audienceRows: withData,
            bucketBroad,
            stats: {
                totalSpend: totalGlobalSpend,
                totalLeads: totalGlobalLeads,
                avgCpl: totalGlobalLeads > 0 ? totalGlobalSpend / totalGlobalLeads : 0,
                totalActivePillars: withData.length,
            },
            loadingAudiences,
        };
    }, [performance, metadata, audienceData, statusFiltro, somenteComDados, tipoFiltro, loadingAudiences]);

    return { audienceRows, bucketBroad, stats, loadingAudiences, error };
}
