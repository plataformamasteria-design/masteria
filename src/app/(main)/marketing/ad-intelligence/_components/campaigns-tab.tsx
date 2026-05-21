"use client";

import { useAccountId } from "@/contexts/ad-account-context";
import { useAdIntelligence } from "./ai-context";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { ChevronDown, BarChart2, Activity, Cpu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { AnalysisDrawer, DrawerPayload } from "./analysis-drawer";
import useSWR from "swr";

export function CampaignsTab() {
  const accountId = useAccountId();
  const { period } = useAdIntelligence();
  
  const [drawerPayload, setDrawerPayload] = useState<DrawerPayload | null>(null);

  const qs = accountId ? `?account_id=${accountId}&since=${period.since === 'hoje' ? new Date().toISOString().slice(0,10) : period.since}&until=${period.until === 'hoje' ? new Date().toISOString().slice(0,10) : period.until}&level=campaign` : null;
  const { data: rawData, isLoading } = useSWR(qs ? `/api/meta/insights${qs}` : null, url => fetch(url).then(r => r.json()), {
    revalidateOnFocus: false
  });

  const campaigns = rawData?.data || [];
  
  if (isLoading) {
    return (
      <SpotlightCard className="border-border bg-black/5 dark:bg-black/20 p-5 overflow-hidden flex flex-col justify-center items-center py-20">
         <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin mb-4" />
         <p className="text-zinc-500 text-xs">Carregando campanhas conectadas (Meta Ads)...</p>
      </SpotlightCard>
    );
  }

  return (
    <SpotlightCard className="border-border bg-black/5 dark:bg-black/20 p-5 overflow-hidden flex flex-col">
       <div className="flex justify-between items-center mb-6">
         <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
           <BarChart2 className="h-4 w-4 text-primary" /> Comparativo Inteligente de Campanhas
         </h3>
       </div>

       <div className="overflow-x-auto">
         <table className="w-full text-left text-sm whitespace-nowrap min-w-[1000px]">
           <thead className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider border-b border-border">
             <tr>
               <th className="px-4 py-3">Campanha</th>
               <th className="px-4 py-3 text-right">Gasto</th>
               <th className="px-4 py-3 text-right">Leads</th>
               <th className="px-4 py-3 text-right">CPL</th>
               <th className="px-4 py-3 text-right">CTR</th>
               <th className="px-4 py-3 text-right">Hook (15s)</th>
               <th className="px-4 py-3 text-right">Freq.</th>
               <th className="px-4 py-3 text-center">Score</th>
               <th className="px-4 py-3">Diagnóstico IA</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-white/5 text-zinc-300 font-medium">
             {campaigns.map((c: any) => (
               <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                 <td className="px-4 py-4 max-w-[250px] truncate flex items-center gap-2">
                   <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] bg-primary")} />
                   {c.name}
                 </td>
                 <td className="px-4 py-4 text-right">R$ {(c.spend || 0).toFixed(2)}</td>
                 <td className="px-4 py-4 text-right">{c.leads || 0}</td>
                 <td className={cn("px-4 py-4 text-right", (c.cpl || 0) > 40 ? "text-destructive font-bold" : "text-primary")}>R$ {(c.cpl || 0).toFixed(2)}</td>
                 <td className="px-4 py-4 text-right">{(c.ctr || 0).toFixed(2)}%</td>
                 <td className="px-4 py-4 text-right">
                   {c.hookRate ? (
                     <span className={cn("px-2 py-0.5 rounded text-[11px] font-bold", c.hookRate >= 25 ? "bg-primary/10 text-primary" : c.hookRate >= 15 ? "bg-amber-500/10 text-amber-400" : "bg-destructive/10 text-destructive")}>
                       {c.hookRate.toFixed(2)}%
                     </span>
                   ) : <span className="text-zinc-600">—</span>}
                 </td>
                 <td className="px-4 py-4 text-right">{(c.frequency || 0).toFixed(1)}x</td>
                 <td className="px-4 py-4 text-center">
                    <span className={cn("px-2 py-1 flex items-center justify-center gap-1 mx-auto w-12 rounded-lg text-xs font-black", 
                        (c.score || 50) >= 80 ? "bg-primary/20 text-primary border border-primary/30" : 
                        (c.score || 50) <= 50 ? "bg-destructive/20 text-destructive border border-destructive/30" : 
                        "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    )}>
                      {c.score || 50}
                    </span>
                 </td>
                 <td className="px-4 py-4 min-w-[300px]">
                   <div className="flex items-start gap-2 text-xs">
                     <Cpu className={cn("h-4 w-4 shrink-0 mt-0.5", c.score >= 80 ? "text-primary" : "text-amber-400")} />
                     <div className="flex flex-col gap-2">
                       <span className="text-zinc-400 whitespace-normal break-words leading-tight">
                         {c.score >= 80 ? "Campanha de alta performance. Recomenda-se escalar gradualmente o orçamento. O CPL está consistente." : c.score <= 50 ? "Custo elevado e fadiga detectada. Analise a rotatividade de criativos imediatamente para evitar sangria." : "Desempenho dentro da média. Nenhuma anomalia gritante encontrada na última janela móvel."}
                       </span>
                       <button 
                         onClick={() => setDrawerPayload({
                           id: c.id, type: "campaign", name: c.name, score: c.score || 50, spend: c.spend || 0, cpl: c.cpl || 0, ctr: c.ctr || 0, 
                           aiDiagnosis: (c.score || 50) >= 80 
                             ? `O CPL de R$${(c.cpl || 0).toFixed(2)} está excelente. A alocação de R$${(c.spend || 0).toFixed(2)} foi bem convertida em Leads. Recomendação formal: Aumentar o budget em 20% pelas próximas 48 horas.` 
                             : (c.score || 50) <= 50 
                               ? `Hemorragia de Spend detectada! Gasto de R$${(c.spend || 0).toFixed(2)} resultou em um Custo por Lead inflado. Interromper imediatamente as variantes de menor CTR.`
                               : `Estabilidade moderada. O CTR de ${(c.ctr || 0).toFixed(2)}% não é suficiente para alavancagem profunda. Criar teste de Copy paralelo.`
                         })}
                         className="flex items-center gap-1.5 w-fit px-2 py-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-black/10 dark:bg-white/10 text-zinc-300 rounded text-[10px] uppercase font-bold tracking-widest border border-border transition-colors"
                       >
                         <Search className="h-3 w-3" /> Ver Análise Detalhada
                       </button>
                     </div>
                   </div>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
       
       <AnalysisDrawer isOpen={drawerPayload !== null} onClose={() => setDrawerPayload(null)} payload={drawerPayload} />
    </SpotlightCard>
  );
}
