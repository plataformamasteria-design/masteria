"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { CreativeWithMetrics } from "@/lib/types/metaVideo";

const HOOK_TYPES: Record<string, string[]> = {
  "Autoridade": ["advogado", "especialista", "anos de", "experiencia"],
  "Dor": ["problema", "dor", "prejuizo", "erro", "perder", "cuidado"],
  "Curiosidade": ["?", "descubra", "segredo", "ninguem", "poucos"],
  "Prova Social": ["prova", "resultado", "caso", "cliente", "ganhou", "faturou"],
  "Oferta": ["gratis", "desconto", "bonus", "oferta", "vagas"],
};

function detectHookType(name: string): string {
  const lower = name.toLowerCase();
  for (const [tipo, keywords] of Object.entries(HOOK_TYPES)) {
    if (keywords.some((k) => lower.includes(k))) return tipo;
  }
  return "Outro";
}

interface LeadData {
  leads: number;
  cpl: number;
  mql: number;
  cpql: number;
  taxa_mql: number;
}

export function HookRanking() {
  const { queryString } = useDateFilter();
  const [ads, setAds] = useState<CreativeWithMetrics[]>([]);
  const [leadsByAd, setLeadsByAd] = useState<Record<string, LeadData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meta-video?${queryString}`).then((r) => r.json()).then((d) => {
      setAds((d.data || []).sort((a: CreativeWithMetrics, b: CreativeWithMetrics) => b.metrics.hookRate - a.metrics.hookRate));
      setLoading(false);
    }).catch(() => setLoading(false));

    // Enrich with leads/MQL per ad_id
    const since = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    Promise.all([
      supabase.from("ads_performance").select("ad_id,spend,leads").gte("data_ref", since).limit(5000),
      supabase.from("leads_crm").select("ad_id, ad_id_vinculado, etapa"),
    ]).then(([perfRes, leadsRes]) => {
      const perfAgg: Record<string, { spend: number; leads: number }> = {};
      (perfRes.data || []).forEach((p: { ad_id: string; spend: number | string; leads: number }) => {
        const e = perfAgg[p.ad_id] || { spend: 0, leads: 0 };
        e.spend += Number(p.spend); e.leads += p.leads;
        perfAgg[p.ad_id] = e;
      });

      const QUALIFIED_STAGES = ["qualificado", "lead_qualificado", "reuniao_agendada", "reuniao_feita", "proposta_enviada", "negociacao", "follow_up", "assinatura_contrato", "comprou"];
      const mqlByAd: Record<string, number> = {};
      (leadsRes.data || []).forEach((l: { ad_id: string | null; ad_id_vinculado: string | null; etapa: string }) => {
        const adId = l.ad_id || l.ad_id_vinculado;
        if (!adId) return;
        if (QUALIFIED_STAGES.includes(l.etapa)) {
          mqlByAd[adId] = (mqlByAd[adId] || 0) + 1;
        }
      });

      const out: Record<string, LeadData> = {};
      for (const [id, v] of Object.entries(perfAgg)) {
        const mql = mqlByAd[id] || 0;
        out[id] = {
          leads: v.leads,
          cpl: v.leads > 0 ? v.spend / v.leads : 0,
          mql,
          cpql: mql > 0 ? v.spend / mql : 0,
          taxa_mql: v.leads > 0 ? (mql / v.leads) * 100 : 0,
        };
      }
      setLeadsByAd(out);
    });
  }, [queryString]);

  if (loading) return <Card><CardContent className="py-8"><div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}</div></CardContent></Card>;

  const maxHook = ads.length > 0 ? ads[0].metrics.hookRate : 100;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Ranking de Hooks</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {ads.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem dados de video</p>}
        {ads.slice(0, 10).map((ad, i) => {
          const hookType = detectHookType(ad.name);
          const isTop3 = i < 3;
          const leadData = leadsByAd[ad.id];
          return (
            <div key={ad.id} className={`flex items-center gap-3 p-2 rounded-lg ${isTop3 ? "border border-yellow-500/30 bg-yellow-500/5" : ""}`}>
              <span className={`text-xs font-bold w-6 ${isTop3 ? "text-yellow-400" : "text-muted-foreground"}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" title={ad.name}>{ad.name}</p>
                <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                  <div className={`h-full rounded-full ${ad.metrics.hookRate >= 40 ? "bg-emerald-500" : ad.metrics.hookRate >= 25 ? "bg-green-500" : ad.metrics.hookRate >= 15 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${(ad.metrics.hookRate / maxHook) * 100}%` }} />
                </div>
              </div>
              <span className={`text-xs font-bold shrink-0 ${ad.metrics.hookRate >= 40 ? "text-emerald-400" : ad.metrics.hookRate >= 25 ? "text-green-400" : ad.metrics.hookRate >= 15 ? "text-yellow-400" : "text-red-400"}`}>
                {ad.metrics.hookRate.toFixed(1)}%
              </span>
              <div className="text-right shrink-0 w-12">
                <p className="text-[9px] text-muted-foreground leading-none">Leads</p>
                <p className="text-[11px] font-semibold">{leadData?.leads ?? "—"}</p>
              </div>
              <div className="text-right shrink-0 w-12">
                <p className="text-[9px] text-muted-foreground leading-none">MQL</p>
                <p className="text-[11px] font-semibold">{leadData?.mql ?? "—"}</p>
              </div>
              <div className="text-right shrink-0 w-14">
                <p className="text-[9px] text-muted-foreground leading-none">CPL</p>
                <p className="text-[11px] font-semibold">{leadData?.cpl ? formatCurrency(leadData.cpl) : "—"}</p>
              </div>
              <div className="text-right shrink-0 w-14">
                <p className="text-[9px] text-muted-foreground leading-none">CPQL</p>
                <p className="text-[11px] font-semibold">{leadData?.cpql ? formatCurrency(leadData.cpql) : "—"}</p>
              </div>
              <Badge variant="outline" className="text-[9px] shrink-0">{hookType}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
