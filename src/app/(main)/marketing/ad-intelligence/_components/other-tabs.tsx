"use client";

import useSWR from "swr";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Users, BellRing, Cpu, Target, LineChart, AlertTriangle, CheckCircle2, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Line, LineChart as RechartsLineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

import { useAccountId } from "@/contexts/ad-account-context";
import { useAdIntelligence } from "./ai-context";

export function AudiencesTab() {
  const audiences = [
    { id: "aud1", name: "LAL 1% Compradores", type: "Lookalike", size: "1.2M", cpm: 25.50, freq: 1.2, score: 85, diagnosis: "Ótima escala. Custo baixo de alcance e renovação constante.", warning: false },
    { id: "aud2", name: "Retargeting 30D", type: "Retargeting", size: "45K", cpm: 48.00, freq: 8.5, score: 35, diagnosis: "Público saturado. A frequência estourou e o CPM dobrou nesta semana.", warning: true },
    { id: "aud3", name: "Aberto - Jovens", type: "Aberto", size: "18M", cpm: 12.00, freq: 1.0, score: 55, diagnosis: "Público promissor e barato, mas as conversões estão baixas. Requer filtro na copy.", warning: false },
  ];

  return (
    <SpotlightCard className="border-border bg-black/5 dark:bg-black/20 p-5 overflow-hidden flex flex-col">
       <div className="flex justify-between items-center mb-6">
         <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
           <Users className="h-4 w-4 text-primary" /> Audience Intelligence
         </h3>
       </div>

       <div className="overflow-x-auto">
         <table className="w-full text-left text-sm whitespace-nowrap min-w-[900px]">
           <thead className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider border-b border-border">
             <tr>
               <th className="px-4 py-3">Público / Conjunto</th>
               <th className="px-4 py-3 text-center">Tipo</th>
               <th className="px-4 py-3 text-right">Tamanho</th>
               <th className="px-4 py-3 text-right">CPM</th>
               <th className="px-4 py-3 text-right">Frequência</th>
               <th className="px-4 py-3 text-center">Score</th>
               <th className="px-4 py-3">Diagnóstico IA</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-white/5 text-zinc-300 font-medium">
             {audiences.map(a => (
               <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                 <td className="px-4 py-4 max-w-[200px] truncate">{a.name}</td>
                 <td className="px-4 py-4 text-center">
                    <span className="px-2 py-0.5 rounded border border-border text-xs text-zinc-400 bg-black/5 dark:bg-white/5">{a.type}</span>
                 </td>
                 <td className="px-4 py-4 text-right text-zinc-400">{a.size}</td>
                 <td className="px-4 py-4 text-right">R$ {a.cpm.toFixed(2)}</td>
                 <td className={cn("px-4 py-4 text-right", a.warning && "text-destructive font-bold")}>{a.freq.toFixed(1)}x</td>
                 <td className="px-4 py-4 text-center">
                    <span className={cn("px-2 py-1 flex items-center justify-center gap-1 mx-auto w-12 rounded-lg text-xs font-black", 
                        a.score > 70 ? "bg-primary/20 text-primary border border-primary/30" : 
                        a.score < 50 ? "bg-destructive/20 text-destructive border border-destructive/30" : 
                        "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    )}>{a.score}</span>
                 </td>
                 <td className="px-4 py-4 min-w-[300px]">
                   <div className="flex items-start gap-2 text-xs">
                     {a.warning ? <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5"/> : <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5"/>}
                     <span className="text-zinc-400 leading-tight whitespace-normal">{a.diagnosis}</span>
                   </div>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
    </SpotlightCard>
  );
}

export function AlertsTab() {
  const { fullReport } = useAdIntelligence();
  
  const alerts = fullReport ? (
    fullReport.error ? [{
      id: "alt_ai_err",
      sev: "critical",
      type: "Erro IA",
      text: fullReport.error,
      action: "Verifique sua configuração ou tente novamente."
    }] : [{ 
      id: "alt_ai1", 
      sev: fullReport.priority === 'critical' ? 'critical' : fullReport.priority === 'high' ? 'important' : 'attention', 
      type: "IA Global", 
      text: fullReport.diagnosis, 
      action: fullReport.recommendation 
    }]
  ) : [
    { id: "alt1", sev: "critical", type: "Sistema", text: "Nenhuma Análise Recente Gerada. Clique em Gerar Análise Profunda no Topo para popular com inteligência verdadeira da Meta.", action: "Gerar Inteligência" }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2 px-2">
        <BellRing className="h-4 w-4 text-primary" /> Alert Center
      </h3>
      <div className="grid gap-3">
        {alerts.map(a => (
          <SpotlightCard key={a.id} className={cn(
            "p-5 border-l-4 rounded-xl flex items-center justify-between",
            a.sev === "critical" ? "border-l-red-500 bg-destructive/10" :
            a.sev === "important" ? "border-l-accent bg-accent-foreground/10" :
            "border-l-amber-500 bg-amber-950/10"
          )}>
            <div>
               <div className="flex items-center gap-2 mb-1">
                 <span className={cn(
                    "uppercase text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded",
                    a.sev === "critical" ? "bg-destructive text-foreground" :
                    a.sev === "important" ? "bg-accent text-foreground" :
                    "bg-amber-500 text-foreground"
                 )}>{a.sev}</span>
                 <span className="text-zinc-500 text-xs font-mono">{a.type}</span>
               </div>
               <p className="text-sm text-foreground font-medium">{a.text}</p>
               <p className="text-xs text-zinc-400 mt-1"><span className="font-bold text-zinc-300">Ação Sugerida:</span> {a.action}</p>
            </div>
          </SpotlightCard>
        ))}
      </div>
    </div>
  );
}

export function RecommendationsTab() {
  const { fullReport } = useAdIntelligence();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2 px-2">
        <Cpu className="h-4 w-4 text-primary" /> Plano de Ação IA
      </h3>
      <div className="grid grid-cols-1 gap-4">
        <SpotlightCard className="p-5 border-border flex flex-col items-start bg-gradient-to-b from-transparent to-accent-foreground/5">
          <div className="w-full flex justify-between items-start mb-3">
             <div className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
               Intervenção Estratégica
             </div>
             <span className="text-xs font-mono text-zinc-500">Global Hub</span>
          </div>

          {fullReport ? (
            fullReport.error ? (
              <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-center gap-3 w-full">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-destructive">Falha na Inteligência Artificial</h4>
                  <p className="text-xs text-zinc-400 mt-1">{fullReport.error}</p>
                </div>
              </div>
            ) : (
            <div className="space-y-4 w-full">
              <div>
                <h4 className="text-sm font-bold text-foreground">Diagnóstico</h4>
                <p className="text-xs text-zinc-400 mt-1">{fullReport.diagnosis}</p>
              </div>
              {fullReport.likelyCause && (
                <div>
                  <h4 className="text-sm font-bold text-foreground">Causa Provável</h4>
                  <p className="text-xs text-zinc-400 mt-1">{fullReport.likelyCause}</p>
                </div>
              )}
              {fullReport.evidence?.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-foreground">Evidências</h4>
                  <ul className="list-disc list-inside text-xs text-zinc-400 mt-1 space-y-1">
                    {fullReport.evidence.map((e: string, i: number) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl">
                <h4 className="text-sm font-bold text-primary">Recomendação</h4>
                <p className="text-xs text-zinc-300 mt-1">{fullReport.recommendation}</p>
                {fullReport.expectedImpact && (
                  <p className="text-[10px] text-zinc-500 mt-2">Impacto esperado: {fullReport.expectedImpact}</p>
                )}
              </div>
              {fullReport.nextTest && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                  <p className="text-xs text-amber-300"><strong>Próximo teste:</strong> {fullReport.nextTest}</p>
                </div>
              )}
            </div>
            )
          ) : (
            <div className="text-center w-full py-8">
              <Cpu className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-zinc-400">Nenhuma análise gerada</h4>
              <p className="text-xs text-zinc-500 mt-2">
                Clique em <strong className="text-primary">"Gerar Análise Profunda"</strong> no topo da página para obter diagnóstico, causa provável, evidências e recomendações da IA.
              </p>
            </div>
          )}
        </SpotlightCard>
      </div>
    </div>
  );
}

export function BenchmarkTab() {
  const accountId = useAccountId();
  const { period } = useAdIntelligence();

  // Current month data
  const bParams = new URLSearchParams({ since: period.since, until: period.until, breakdown: "none", level: "campaign" });
  if (accountId) bParams.set("account_id", accountId);
  const { data: currentData, isLoading } = useSWR(`/api/meta/insights?${bParams.toString()}`, url => fetch(url).then(r => r.json()), { revalidateOnFocus: false });

  // Historical 6 months (for benchmark)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const histSince = sixMonthsAgo.toISOString().slice(0, 10);
  const hParams = new URLSearchParams({ since: histSince, until: period.until, breakdown: "none", level: "campaign" });
  if (accountId) hParams.set("account_id", accountId);
  const { data: histData } = useSWR(`/api/meta/insights?${hParams.toString()}`, url => fetch(url).then(r => r.json()), { revalidateOnFocus: false });

  if (isLoading) {
    return (
      <SpotlightCard className="border-border bg-black/5 dark:bg-black/20 p-6 flex flex-col min-h-[300px] justify-center items-center">
        <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <p className="text-zinc-500 text-xs mt-4">Carregando benchmark...</p>
      </SpotlightCard>
    );
  }

  const current = currentData?.totals;
  const hist = histData?.totals;

  const currentCpl = current?.leads > 0 ? current.spend / current.leads : 0;
  const histCpl = hist?.leads > 0 ? hist.spend / hist.leads : 0;
  const currentCtr = current?.impressions > 0 ? (current.clicks / current.impressions) * 100 : 0;
  const histCtr = hist?.impressions > 0 ? (hist.clicks / hist.impressions) * 100 : 0;

  const fmtMoney = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(v);

  // Position on scale (lower CPL = better, scale 0-100)
  const maxCpl = Math.max(currentCpl, histCpl) * 2 || 80;
  const positionPct = maxCpl > 0 ? Math.min(100, (currentCpl / maxCpl) * 100) : 50;
  const deltaVsHist = histCpl > 0 ? Math.round(((currentCpl - histCpl) / histCpl) * 100) : 0;

  const hasData = current && current.spend > 0;

  return (
    <SpotlightCard className="border-border bg-black/5 dark:bg-black/20 p-6 flex flex-col min-h-[300px]">
       <div className="flex justify-between items-center mb-6">
         <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
           <Target className="h-4 w-4 text-primary" /> Benchmark da Conta (Periodo vs Historico 6m)
         </h3>
       </div>

       {!hasData ? (
         <div className="flex-1 flex items-center justify-center">
           <p className="text-zinc-500 text-sm">Sem dados suficientes para o periodo selecionado.</p>
         </div>
       ) : (
         <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
           <div className="col-span-1 border border-border bg-black/5 dark:bg-black/40 rounded-xl p-5 text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Seu CPL Atual</span>
              <p className="text-4xl font-black text-foreground mt-2 border-b border-border pb-4 mb-4">{fmtMoney(currentCpl)}</p>
              {deltaVsHist !== 0 && (
                <span className={cn("text-xs font-bold px-2 py-1 rounded", deltaVsHist > 0 ? "text-destructive bg-destructive/10" : "text-primary bg-primary/10")}>
                  {deltaVsHist > 0 ? "+" : ""}{deltaVsHist}% vs Media 6m
                </span>
              )}
           </div>

           <div className="col-span-1 md:col-span-2 space-y-4">
              <div className="relative pt-6">
                 <span className="absolute top-0 left-0 text-xs text-zinc-400">Benchmark Interno (Historico 6 meses)</span>
                 <div className="h-4 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden w-full relative">
                   <div className="absolute top-0 left-0 h-full bg-primary transition-all duration-700" style={{ width: `${100 - positionPct}%` }}></div>
                 </div>
                 <div className="flex justify-between mt-1 text-[10px] font-mono text-zinc-500">
                   <span>{fmtMoney(0)} (Melhor)</span>
                   <span>Media 6m: {fmtMoney(histCpl)}</span>
                   <span>{fmtMoney(maxCpl)} (Pior)</span>
                 </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-black/5 dark:bg-black/40 border border-border rounded-lg p-3 text-center">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold">CTR Atual</span>
                  <p className="text-lg font-bold text-foreground mt-1">{currentCtr.toFixed(2)}%</p>
                </div>
                <div className="bg-black/5 dark:bg-black/40 border border-border rounded-lg p-3 text-center">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold">CTR Hist. 6m</span>
                  <p className="text-lg font-bold text-zinc-400 mt-1">
                    {histCtr > 0 ? `${histCtr.toFixed(2)}%` : (
                      <span className="text-xs text-yellow-400" title="Dados insuficientes no histórico de 6 meses">Hist. insuficiente</span>
                    )}
                  </p>
                </div>
                <div className="bg-black/5 dark:bg-black/40 border border-border rounded-lg p-3 text-center">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold">Leads Periodo</span>
                  <p className="text-lg font-bold text-foreground mt-1">{current?.leads || 0}</p>
                </div>
              </div>

              <p className="text-sm text-zinc-400 leading-relaxed bg-accent/5 p-4 rounded-lg border border-accent/10">
                <strong className="text-primary">Análise:</strong>{" "}
                {deltaVsHist > 20
                  ? `CPL ${deltaVsHist}% acima da média histórica. Revisar criativos e segmentação para reduzir custo.`
                  : deltaVsHist > 0
                  ? `CPL levemente acima da média histórica (+${deltaVsHist}%). Dentro da margem, monitorar.`
                  : deltaVsHist < -10
                  ? `CPL ${Math.abs(deltaVsHist)}% abaixo da média histórica. Performance excelente no período.`
                  : `CPL estável em relação ao histórico. Operação consistente.`
                }
              </p>
           </div>
         </div>
       )}
    </SpotlightCard>
  );
}

export function TimelineTab() {
  const accountId = useAccountId();
  const { period } = useAdIntelligence();

  const tParams = new URLSearchParams({ since: period.since, until: period.until, breakdown: "daily", level: "campaign" });
  if (accountId) tParams.set("account_id", accountId);
  const { data: rawData, isLoading } = useSWR(`/api/meta/insights?${tParams.toString()}`, url => fetch(url).then(r => r.json()), {
    revalidateOnFocus: false
  });

  // Transforma o retorno de Breakdown Daily do backend para se encaixar no recharts
  const data = (rawData?.data || []).map((row: any) => ({
    name: new Date(row.date).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }),
    cpl: row.cpl || 0,
    spend: row.spend || 0
  })).sort((a: any, b: any) => a.name.localeCompare(b.name));

  if (isLoading) return <SpotlightCard className="border-border bg-black/5 dark:bg-black/20 p-6 min-h-[400px] flex justify-center items-center"><div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full"></div></SpotlightCard>;

  return (
    <SpotlightCard className="border-border bg-black/5 dark:bg-black/20 p-6 min-h-[400px] flex flex-col">
       <div className="flex justify-between items-center mb-6">
         <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
           <LineChart className="h-4 w-4 text-primary" /> Evolução Temporal
         </h3>
       </div>
       
       <div className="flex-1 w-full h-[250px] bg-black/5 dark:bg-black/40 rounded-xl border border-border p-4 relative">
         <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" stroke="currentColor" fontSize={11} className="text-zinc-500" tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" stroke="currentColor" fontSize={11} className="text-zinc-500" tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
              <YAxis yAxisId="right" orientation="right" stroke="currentColor" fontSize={11} className="text-zinc-500" hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#09090b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#e4e4e7' }}
                formatter={(val: number) => [`R$ ${val.toFixed(2)}`, '']}
              />
              <Line yAxisId="left" type="monotone" dataKey="cpl" stroke="#ef4444" name="CPL" dot={{r: 4, fill: '#ef4444', strokeWidth: 0}} activeDot={{r: 6}} />
              <Line yAxisId="right" type="monotone" dataKey="spend" stroke="#3f3f46" name="Gasto" dot={false} />
            </RechartsLineChart>
         </ResponsiveContainer>
       </div>
       
       {data.length > 2 && (() => {
         const cpls = data.filter((d: any) => d.cpl > 0).map((d: any) => d.cpl);
         if (cpls.length < 2) return null;
         const avg = cpls.reduce((s: number, v: number) => s + v, 0) / cpls.length;
         const maxEntry = data.reduce((best: any, d: any) => d.cpl > (best?.cpl || 0) ? d : best, data[0]);
         const minEntry = data.reduce((best: any, d: any) => d.cpl > 0 && d.cpl < (best?.cpl || Infinity) ? d : best, data[0]);
         const pctAbove = avg > 0 ? Math.round(((maxEntry.cpl - avg) / avg) * 100) : 0;
         if (pctAbove < 30) return null;
         return (
           <div className="mt-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
             <BarChart2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
             <p className="text-sm text-zinc-300">
               <strong className="text-foreground">Variação detectada:</strong> O dia com maior CPL foi {maxEntry.name} (R$ {maxEntry.cpl.toFixed(2)}), {pctAbove}% acima da média do período (R$ {avg.toFixed(2)}). Melhor dia: {minEntry.name} (R$ {minEntry.cpl.toFixed(2)}).
             </p>
           </div>
         );
       })()}
    </SpotlightCard>
  );
}
