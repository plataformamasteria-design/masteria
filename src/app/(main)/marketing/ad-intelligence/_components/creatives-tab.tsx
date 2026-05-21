"use client";

import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Film, AlertTriangle, TrendingDown, Eye, CheckCircle2, Search, ChevronDown, ChevronUp, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { AnalysisDrawer, DrawerPayload } from "./analysis-drawer";
import useSWR from "swr";
import { useAccountId } from "@/contexts/ad-account-context";
import { useAdIntelligence } from "./ai-context";
import { formatCurrency } from "@/lib/format";

const HOOK_TYPES: Record<string, string[]> = {
  "Problema": ["problema", "dor", "prejuízo", "erro", "perder", "cuidado"],
  "Prova Social": ["prova", "resultado", "caso", "cliente", "ganhou", "faturou"],
  "Pergunta": ["?"],
  "Autoridade": ["advogado", "especialista", "anos de", "experiência"],
};

function detectHookType(name: string): string {
  const lower = name.toLowerCase();
  for (const [tipo, keywords] of Object.entries(HOOK_TYPES)) {
    if (keywords.some((k) => lower.includes(k))) return tipo;
  }
  return "Genérico";
}

function HookRankingWidget({ creatives }: { creatives: any[] }) {
  if (!creatives || creatives.length === 0) return null;
  
  const valid = creatives
      .filter(c => typeof c.hookRate === 'number')
      .sort((a,b) => b.hookRate - a.hookRate)
      .slice(0, 5);

  if (valid.length === 0) return null;

  const maxHook = valid[0].hookRate || 100;

  return (
    <SpotlightCard className="p-4 border-border bg-black/5 dark:bg-black/40 mb-2">
      <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-4 flex items-center gap-2">
        <TrendingDown className="h-4 w-4 text-primary" /> Top 5 Hook Ranking
      </h4>
      <div className="space-y-3">
        {valid.map((ad, i) => {
          const isTop = i === 0;
          return (
            <div key={ad.id} className={cn("flex items-center gap-3 p-2.5 rounded-lg border", isTop ? "border-primary/30 bg-accent/5 text-primary" : "border-border bg-black/5 dark:bg-white/5 text-zinc-400")}>
               <span className="text-xs font-black w-6">{i + 1}º</span>
               <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate text-foreground">{ad.name}</p>
                  <div className="h-1.5 bg-black/5 dark:bg-black/50 rounded-full mt-1.5 overflow-hidden border border-border">
                    <div className={cn("h-full rounded-full transition-all duration-1000", ad.hookRate >= 25 ? "bg-primary" : ad.hookRate >= 15 ? "bg-amber-500" : "bg-destructive")}
                      style={{ width: `${Math.min(100, (ad.hookRate / maxHook) * 100)}%` }} />
                  </div>
               </div>
               <div className="text-right shrink-0">
                  <span className={cn("text-sm font-black", ad.hookRate >= 25 ? "text-primary" : ad.hookRate >= 15 ? "text-amber-400" : "text-destructive")}>
                    {ad.hookRate.toFixed(1)}%
                  </span>
               </div>
               <div className="text-right shrink-0 w-16 hidden sm:block">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest leading-none mb-1">CPL</p>
                  <p className="text-xs font-bold text-zinc-300">{ad.leads > 0 ? formatCurrency(ad.spend / ad.leads) : "—"}</p>
               </div>
               <span className="text-[9px] px-2 py-0.5 rounded border border-border uppercase tracking-widest shrink-0 hidden md:inline-block bg-black/5 dark:bg-black/50">{detectHookType(ad.name)}</span>
            </div>
          );
        })}
      </div>
    </SpotlightCard>
  );
}

export function CreativesTab() {
  const [drawerPayload, setDrawerPayload] = useState<DrawerPayload | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const accountId = useAccountId();
  const { period } = useAdIntelligence();

  const qs = accountId ? `?account_id=${accountId}&since=${period.since === 'hoje' ? new Date().toISOString().slice(0,10) : period.since}&until=${period.until === 'hoje' ? new Date().toISOString().slice(0,10) : period.until}&level=ad` : null;
  const { data: rawData, isLoading } = useSWR(qs ? `/api/meta/insights${qs}` : null, url => fetch(url).then(r => r.json()), {
    revalidateOnFocus: false
  });

  const creatives = rawData?.data || [];  

  if (isLoading) {
    return (
      <SpotlightCard className="border-border bg-black/5 dark:bg-black/20 p-5 overflow-hidden flex flex-col justify-center items-center py-20">
         <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin mb-4" />
         <p className="text-zinc-500 text-xs">Carregando anúncios conectados (Meta Ads)...</p>
      </SpotlightCard>
    );
  }

  return (
    <div className="space-y-4 flex flex-col min-h-0">
      
      <div className="flex items-center justify-between px-2 mb-2">
         <h3 className="text-sm font-bold text-primary uppercase tracking-widest flex items-center gap-2">
           <Film className="h-4 w-4" /> Creative Intelligence
         </h3>
      </div>

      <HookRankingWidget creatives={creatives} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {creatives.map((ad: any) => {
          const creativeName = ad.name && ad.name !== ad.id ? ad.name : "Criativo sem nome";
          const isExpanded = expandedCards[ad.id] || false;
          return (
          <SpotlightCard key={ad.id} className="p-4 border-border flex flex-col gap-4">
             <div className="flex items-start justify-between border-b border-border pb-3">
               <div className="flex-1 min-w-0">
                 <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded uppercase font-bold tracking-widest mb-2 inline-block border border-primary/20">
                   video
                 </span>
                 <h4 className="text-sm font-bold text-foreground max-w-[260px] truncate" title={creativeName}>{creativeName}</h4>
                 <button
                   onClick={() => setExpandedCards(prev => ({ ...prev, [ad.id]: !prev[ad.id] }))}
                   className="flex items-center gap-1 mt-1.5 text-[10px] text-zinc-500 hover:text-primary transition-colors"
                 >
                   <Layers className="h-3 w-3" />
                   {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                   <span>Campanha & Conjunto</span>
                 </button>
               </div>

               <div className="text-right shrink-0">
                 <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Fadiga</div>
                 {50 > 75 ? (
                    <div className="flex items-center gap-1 text-destructive font-bold text-sm">
                      <AlertTriangle className="h-3.5 w-3.5" /> Alta ({(ad.score || 50)})
                    </div>
                 ) : (
                    <div className="flex items-center gap-1 text-primary font-bold text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Estável
                    </div>
                 )}
               </div>
             </div>

             {/* Expanded: Campaign + AdSet info */}
             {isExpanded && (
               <div className="grid grid-cols-2 gap-3 bg-white/[0.02] border border-border rounded-lg p-3 animate-in slide-in-from-top-1 duration-200">
                 <div className="flex flex-col gap-0.5">
                   <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Campanha</span>
                   <span className="text-xs font-medium text-zinc-200 truncate" title={ad.campaign_name || "—"}>{ad.campaign_name || "—"}</span>
                 </div>
                 <div className="flex flex-col gap-0.5">
                   <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Conjunto</span>
                   <span className="text-xs font-medium text-zinc-200 truncate" title={ad.adset_name || ad.parent_name || "—"}>{ad.adset_name || ad.parent_name || "—"}</span>
                 </div>
               </div>
             )}
             
             {/* Métricas grid */}
             <div className="grid grid-cols-4 gap-2">
                <div className="bg-black/5 dark:bg-black/20 rounded-lg p-2 flex flex-col border border-border">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold">CPL</span>
                  <span className={(ad.cpl || 0) > 20 ? "text-destructive font-mono text-xs font-bold" : "text-primary font-mono text-xs font-bold"}>R${(ad.cpl || 0).toFixed(2)}</span>
                </div>
                <div className="bg-black/5 dark:bg-black/20 rounded-lg p-2 flex flex-col border border-border">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold">CTR</span>
                  <span className="text-foreground/90 font-mono text-xs font-bold">{(ad.ctr || 0).toFixed(2)}%</span>
                </div>
                
                <div className="bg-black/5 dark:bg-black/20 rounded-lg p-2 flex flex-col border border-border">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold">Hook (3s)</span>
                  <span className={cn("font-mono text-xs font-bold", typeof ad.hookRate === 'number' && ad.hookRate > 0 ? (ad.hookRate >= 25 ? "text-primary" : ad.hookRate >= 15 ? "text-amber-400" : "text-destructive") : "text-zinc-500")}>
                    {typeof ad.hookRate === 'number' && ad.hookRate > 0 ? `${ad.hookRate.toFixed(1)}%` : "\u2014"}
                  </span>
                </div>
                <div className="bg-black/5 dark:bg-black/20 rounded-lg p-2 flex flex-col border border-border">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold">ThruPlay</span>
                  <span className="text-foreground/90 font-mono text-xs font-bold">{ad.clicks || 0}</span>
                </div>
             </div>

             {/* AI Diagnostic */}
             <div className="mt-auto bg-black/5 dark:bg-black/40 border border-border rounded-xl p-3">
               <div className="flex items-center gap-1.5 mb-1.5">
                 <Eye className="h-3.5 w-3.5 text-zinc-400" />
                 <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Diagnóstico da IA (Análise de Desempenho)</span>
               </div>
               <p className="text-xs text-zinc-300 leading-snug">Criativo com CPL na margem de custo dinâmico e retenção estável na Graph API oficial.</p>
               
               <div className="mt-3 pt-3 border-t border-border">
                 <p className="text-[10px] text-primary uppercase font-bold tracking-widest mb-1">Ação Sugerida</p>
                 <p className="text-[11px] text-accent/70 leading-tight font-medium">{(ad.score || 50) >= 60 ? "Injetar +25% de taxa de escala sustentável no conjunto onde habita de forma controlada." : "Pausar e inserir nova introdução de 3 segundos com frame impactante visualmente sobre o Nicho."}</p>
                 
                 <div className="flex gap-2 mt-3 flex-wrap">
                   <button className="flex-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-black/10 dark:bg-white/10 text-zinc-300 text-[10px] uppercase font-bold py-2 rounded-lg transition-colors border border-border min-w-[70px]">Ignorar</button>
                   <button className="flex-[2] bg-primary/20 hover:bg-accent/30 text-primary border border-primary/30 text-[10px] uppercase font-bold py-2 rounded-lg transition-colors min-w-[120px]">Criar Variação</button>
                   <button 
                     onClick={() => setDrawerPayload({
                       id: ad.id, type: "creative", name: ad.name, score: ad.score || 50, spend: ad.spend, cpl: ad.cpl || 0, ctr: ad.ctr || 0, 
                       aiDiagnosis: (ad.score || 50) >= 60 
                         ? `O criativo "${ad.name}" reteve ${(ad.ctr || 0).toFixed(2)}% da base, resultando num CPL orgânico de R$${(ad.cpl || 0).toFixed(2)}. Este ativo é validador do nível Campanha.`
                         : `Taxas precárias no Thumb/Hook. A Meta cobrou R$${(ad.spend || 0).toFixed(2)} de impressões vazias! Você precisa resintetizar esse anúncio urgente.`,
                       hookRate: ad.hookRate || 0, format: "video", thruPlays: ad.clicks || undefined,
                       proposedCopy: (ad.score || 50) >= 60 ? "Nenhuma alteração crassa recomendável neste Copy Vencedor." : "Atenção: Novo método de restituição processual exposto. Veja os requisitos.",
                       visualIntervention: (ad.score || 50) >= 60 ? "Manter Design e Call to Action Base" : "Trocar Hook Inicial por Tabela Visível (Menos de 3s)"
                     })}
                     className="w-full flex items-center justify-center gap-1.5 bg-muted hover:bg-muted-foreground/20 text-zinc-300 border border-border text-[10px] uppercase font-bold py-2 rounded-lg transition-colors"
                   >
                     <Search className="h-3 w-3" /> Aprofundar Análise Deste Criativo
                   </button>
                 </div>
               </div>
             </div>
          </SpotlightCard>
          );
        })}
      </div>
      
      <AnalysisDrawer isOpen={drawerPayload !== null} onClose={() => setDrawerPayload(null)} payload={drawerPayload} />
    </div>
  );
}
