"use client";

import { useAccountId } from "@/contexts/ad-account-context";
import { useAdIntelligence } from "./ai-context";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Layers, Activity, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";

export function AdsetsTab() {
  const accountId = useAccountId();
  const { period } = useAdIntelligence();

  const qs = accountId ? `?account_id=${accountId}&since=${period.since === 'hoje' ? new Date().toISOString().slice(0,10) : period.since}&until=${period.until === 'hoje' ? new Date().toISOString().slice(0,10) : period.until}&level=adset` : null;
  const { data: rawData, isLoading } = useSWR(qs ? `/api/meta/insights${qs}` : null, url => fetch(url).then(r => r.json()), {
    revalidateOnFocus: false
  });

  const adsets = rawData?.data || [];

  if (isLoading) {
    return (
      <SpotlightCard className="border-border bg-black/5 dark:bg-black/20 p-5 overflow-hidden flex flex-col justify-center items-center py-20">
         <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin mb-4" />
         <p className="text-zinc-500 text-xs">Carregando conjuntos conectados (Meta Ads)...</p>
      </SpotlightCard>
    );
  }

  return (
    <SpotlightCard className="border-border bg-black/5 dark:bg-black/20 p-5 overflow-hidden flex flex-col">
       <div className="flex justify-between items-center mb-6">
         <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
           <Layers className="h-4 w-4 text-primary" /> Análise de Conjuntos
         </h3>
       </div>

       <div className="overflow-x-auto">
         <table className="w-full text-left text-sm whitespace-nowrap min-w-[1000px]">
           <thead className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider border-b border-border">
             <tr>
               <th className="px-4 py-3">Conjunto</th>
               <th className="px-4 py-3 text-right">Gasto</th>
               <th className="px-4 py-3 text-right">CPL</th>
               <th className="px-4 py-3 text-right">Hook (15s)</th>
               <th className="px-4 py-3 text-right">Freq.</th>
               <th className="px-4 py-3 text-center">Score</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-white/5 text-zinc-300 font-medium">
             {adsets.map((c: any) => (
               <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                 <td className="px-4 py-4 max-w-[250px] truncate flex items-center gap-2">
                   <div className={cn("w-2 h-2 rounded-full", c.status === "ACTIVE" ? "bg-primary" : "bg-primary shadow-[0_0_8px_rgba(16,185,129,0.5)]")} />
                   {c.name}
                 </td>
                 <td className="px-4 py-4 text-right">R$ {(c.spend || 0).toFixed(2)}</td>
                 <td className="px-4 py-4 text-right">R$ {(c.cpl || 0).toFixed(2)}</td>
                 <td className="px-4 py-4 text-right">
                   {c.hookRate ? (
                     <span className={cn("px-2 py-0.5 rounded text-[11px] font-bold", c.hookRate >= 25 ? "bg-primary/10 text-primary" : c.hookRate >= 15 ? "bg-amber-500/10 text-amber-400" : "bg-destructive/10 text-destructive")}>
                       {c.hookRate.toFixed(2)}%
                     </span>
                   ) : <span className="text-zinc-600">—</span>}
                 </td>
                 <td className={cn("px-4 py-4 text-right", (c.frequency || 0) > 5 ? "text-amber-400 font-bold" : "")}>{(c.frequency || 0).toFixed(1)}x</td>
                 <td className="px-4 py-4 text-center">
                   <span className={cn("px-2 py-1 flex items-center justify-center gap-1 mx-auto w-12 rounded-lg text-xs font-black bg-muted text-zinc-300 border border-border")}>
                      {c.score || 50}
                   </span>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
    </SpotlightCard>
  );
}
