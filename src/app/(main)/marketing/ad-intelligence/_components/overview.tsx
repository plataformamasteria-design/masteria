"use client";

import useSWR from "swr";
import { useAdIntelligence } from "./ai-context";
import { useAccountId } from "@/contexts/ad-account-context";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Tooltip } from "@/components/ui/tooltip";
import { Loader2, TrendingUp, TrendingDown, Target, DollarSign, Activity, Info, ShieldCheck, AlertTriangle } from "lucide-react";
import { CanalNichoCard } from "./canal-nicho-card";
import { DataHealthBadge, type HealthStatus } from "@/components/trafego/DataHealthBadge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

export function OverviewTab() {
  const accountId = useAccountId();
  const { period, fullReport } = useAdIntelligence();
  const [scoreModalOpen, setScoreModalOpen] = useState(false);

  const params = new URLSearchParams({
    since: period.since,
    until: period.until,
    level: "campaign",
    breakdown: "none",
  });
  if (accountId) params.set("account_id", accountId);
  const qs = `?${params.toString()}`;

  const { data: rawData, isLoading, error } = useSWR(qs ? `/api/meta/insights${qs}` : null, url => fetch(url).then(r => r.json()), {
    revalidateOnFocus: false
  });

  // Auditoria de consistência de dados
  const auditQs = accountId ? `?since=${period.since}&until=${period.until}&account_id=${accountId}` : `?since=${period.since}&until=${period.until}`;
  const { data: auditData } = useSWR(`/api/marketing/audit-data${auditQs}`, url => fetch(url).then(r => r.json()), {
    revalidateOnFocus: false,
    refreshInterval: 5 * 60 * 1000, // re-auditar a cada 5 min
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          <Loader2 className="h-8 w-8 animate-spin text-primary relative z-10" />
        </div>
        <p className="text-sm text-zinc-500 mt-4 font-mono">Processando inteligência de métricas...</p>
      </div>
    );
  }

  if (error || rawData?.error) {
    return (
      <div className="p-8 text-center text-red-500 bg-red-500/10 rounded-xl border border-red-500/20">
        <p className="font-bold">Erro ao carregar inteligência</p>
        <p className="text-xs opacity-70 mt-1">{rawData?.error || "Serviço Indisponível"}</p>
      </div>
    );
  }

  const current = rawData?.totals;
  const previous = rawData?.totals_prev;
  const campaigns: any[] = rawData?.data || [];

  const fmtMoney = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const calcRealDelta = (cur: number=0, prev: number=0) => prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 100);

  // Determinar saúde do dado por métrica baseado na auditoria
  const getHealthStatus = (metricId: string): HealthStatus => {
    if (!auditData?.alerts) return "verified";
    const alert = auditData.alerts.find((a: any) => a.metric === metricId);
    if (!alert) return "verified";
    return alert.severity === "critical" ? "inconsistent" : "warning";
  };

  // Score medio da conta (media ponderada por spend dos scores de campanha)
  const totalSpend = campaigns.reduce((s: number, c: any) => s + (c.spend || 0), 0);
  const accountScore = totalSpend > 0
    ? Math.round(campaigns.reduce((s: number, c: any) => s + (c.score || 0) * (c.spend || 0), 0) / totalSpend)
    : null;

  const currentCpl = current?.leads > 0 ? current.spend / current.leads : 0;
  const prevCpl = previous?.leads > 0 ? previous.spend / previous.leads : 0;

  // Score breakdown para o modal
  const avgCtr = campaigns.length > 0 ? campaigns.reduce((s: number, c: any) => s + (c.ctr || 0), 0) / campaigns.length : 0;
  const avgFreq = campaigns.length > 0 ? campaigns.reduce((s: number, c: any) => s + (c.frequency || 0), 0) / campaigns.length : 0;
  const scoreBreakdown = {
    cpl: { peso: 45, valor: currentCpl, label: "CPL vs benchmark" },
    ctr: { peso: 35, valor: avgCtr, label: "CTR médio" },
    frequencia: { peso: 20, valor: avgFreq, label: "Frequência média" },
  };

  const kpis = [
    { label: "Gasto Total", val: fmtMoney(current?.spend || 0), delta: calcRealDelta(current?.spend, previous?.spend), icon: DollarSign, invertDelta: false, fonte: "Meta Ads API", auditMetric: "investimento", formula: "SUM(spend) via Meta Insights API" },
    { label: "Leads (Meta)", val: current?.leads || 0, delta: calcRealDelta(current?.leads, previous?.leads), icon: Target, invertDelta: false, fonte: "Meta Ads API (actions.lead)", auditMetric: "leads", formula: "SUM(actions.lead + messaging_first_reply + lead_grouped)" },
    { label: "CPL (Meta)", val: fmtMoney(currentCpl), delta: calcRealDelta(currentCpl, prevCpl), icon: Activity, invertDelta: true, fonte: "Meta Ads API", auditMetric: "investimento", formula: "spend / leads (apenas Meta pagos)" },
    { label: "Score da Conta", val: accountScore ?? "\u2014", delta: 0, icon: TrendingUp, invertDelta: false, isScore: true, fonte: "Calculado internamente", auditMetric: "", formula: "Média ponderada por spend (CTR 35% + CPL 45% + Freq 20%)" },
  ];

  // Gerar alertas reais a partir dos dados de campanhas
  const avgCpl = campaigns.length > 0 && current?.leads > 0 ? current.spend / current.leads : 0;
  const criticalAlerts: { name: string; cpl: number; pctAbove: number; score: number; spend: number }[] = [];
  const scaleOpportunities: { name: string; cpl: number; score: number; spend: number }[] = [];
  const fatigueWarnings: { name: string; frequency: number; score: number }[] = [];

  for (const c of campaigns) {
    const cCpl = c.leads > 0 ? c.spend / c.leads : null;
    const freq = c.frequency ?? (c.reach > 0 ? c.impressions / c.reach : null);

    // CPL muito acima da media → alerta critico
    if (cCpl && avgCpl > 0 && cCpl > avgCpl * 1.5 && c.spend > 50) {
      criticalAlerts.push({ name: c.name, cpl: cCpl, pctAbove: Math.round(((cCpl - avgCpl) / avgCpl) * 100), score: c.score || 0, spend: c.spend });
    }
    // Score alto + CPL baixo → oportunidade de escala
    if (c.score >= 65 && cCpl && cCpl < avgCpl * 0.8 && c.leads >= 2) {
      scaleOpportunities.push({ name: c.name, cpl: cCpl, score: c.score, spend: c.spend });
    }
    // Frequencia alta → fadiga
    if (freq && freq > 4 && c.spend > 30) {
      fatigueWarnings.push({ name: c.name, frequency: freq, score: c.score || 0 });
    }
  }

  criticalAlerts.sort((a, b) => b.pctAbove - a.pctAbove);
  scaleOpportunities.sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-6">

      {/* Banner de auditoria de dados */}
      {auditData && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium ${
          auditData.status === "consistent"
            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
            : auditData.status === "critical"
              ? "bg-red-500/10 border border-red-500/20 text-red-400"
              : "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
        }`}>
          {auditData.status === "consistent" ? (
            <>
              <ShieldCheck className="h-4 w-4" />
              <span>Dados consistentes — última auditoria: {new Date(auditData.audit_timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4" />
              <span>{auditData.total_alerts} inconsistência(s) detectada(s)</span>
              <Tooltip content={auditData.alerts?.map((a: any) => a.message).join(" | ") || ""}>
                <span className="underline cursor-help ml-1">ver detalhes</span>
              </Tooltip>
            </>
          )}
        </div>
      )}

      {/* Card Inteligência por Canal e Nicho — Tarefa 9 */}
      <CanalNichoCard />

      {/* HUD Executivo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          // Para CPL, delta positivo = ruim (custo subiu)
          const isGood = k.invertDelta ? k.delta <= 0 : k.delta >= 0;
          const scoreColor = (k as any).isScore && typeof k.val === "number"
            ? k.val >= 70 ? "text-emerald-400" : k.val >= 40 ? "text-yellow-400" : "text-rose-400"
            : "";
          return (
            <SpotlightCard key={i} className="p-5 border-white/5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 flex items-center gap-1">
                  {k.label}
                  <Tooltip content={`${(k as any).isScore ? "Score de 0 a 100 baseado em CPL, CTR e eficiência de gasto. Acima de 70 = bom, 40-70 = monitorar, abaixo de 40 = ação necessária." : k.label}${k.fonte ? ` — Fonte: ${k.fonte}` : ""}`}>
                    <Info className="h-3 w-3 text-zinc-600 cursor-help" />
                  </Tooltip>
                </span>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p className={`text-3xl font-black ${scoreColor}`}>{k.val}</p>
              {(k as any).isScore && typeof k.val === "number" && (
                <button
                  onClick={() => setScoreModalOpen(true)}
                  className="text-[10px] text-primary/70 hover:text-primary underline mt-1 transition-colors"
                >
                  Como é calculado?
                </button>
              )}
              {auditData && k.auditMetric && (
                <div className="mt-1">
                  <DataHealthBadge
                    status={getHealthStatus(k.auditMetric)}
                    fonte={k.fonte}
                    formula={k.formula}
                    ultimaAtualizacao={auditData.audit_timestamp ? new Date(auditData.audit_timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : undefined}
                  />
                </div>
              )}
              {k.delta !== 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
                  {isGood ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                  )}
                  <span className={isGood ? "text-emerald-400" : "text-red-400"}>
                    {k.delta > 0 ? "+" : ""}{k.delta}% vs periodo anterior
                  </span>
                </div>
              )}
            </SpotlightCard>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Alerts Box — dados reais */}
        <div className="col-span-1 lg:col-span-2">
          <SpotlightCard className="p-5 h-full border-accent/10 bg-gradient-to-br from-black to-accent-foreground/10">
            <h3 className="text-sm font-bold text-primary mb-4 uppercase tracking-widest flex items-center gap-2">
              {criticalAlerts.length > 0 && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"/>}
              Ações Críticas
            </h3>

            <div className="space-y-3">
              {criticalAlerts.length === 0 && fatigueWarnings.length === 0 ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-400">Tudo sob controle</h4>
                    <p className="text-xs text-zinc-400 mt-1">Nenhuma campanha com CPL critico ou frequencia excessiva no periodo.</p>
                  </div>
                </div>
              ) : (
                <>
                  {criticalAlerts.slice(0, 3).map((a, i) => (
                    <div key={i} className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                      <h4 className="text-sm font-bold text-red-400">CPL {a.pctAbove}% acima da media</h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        "{a.name}" com CPL {fmtMoney(a.cpl)} (media: {fmtMoney(avgCpl)}). Score: <span className={a.score >= 70 ? "text-emerald-400" : a.score >= 40 ? "text-yellow-400" : "text-rose-400"}>{a.score}/100</span>.
                      </p>
                    </div>
                  ))}
                  {fatigueWarnings.slice(0, 2).map((w, i) => (
                    <div key={`f${i}`} className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                      <h4 className="text-sm font-bold text-amber-400">Fadiga: frequencia {w.frequency.toFixed(1)}x</h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        "{w.name}" — publico vendo o anuncio muitas vezes. Score: <span className={w.score >= 70 ? "text-emerald-400" : w.score >= 40 ? "text-yellow-400" : "text-rose-400"}>{w.score}/100</span>.
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </SpotlightCard>
        </div>

        {/* Plano de Ação — dados reais ou IA */}
        <div className="col-span-1">
           <SpotlightCard className="p-5 h-full border-white/5 bg-black/40">
            <h3 className="text-sm font-bold text-zinc-300 mb-4 uppercase tracking-widest">
              {fullReport ? "Plano IA" : "Oportunidades"}
            </h3>
            {fullReport ? (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400">{fullReport.diagnosis}</p>
                <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg">
                  <p className="text-xs font-bold text-primary">Recomendação:</p>
                  <p className="text-[11px] text-zinc-300 mt-1">{fullReport.recommendation}</p>
                </div>
              </div>
            ) : (
              <ul className="space-y-4">
                {scaleOpportunities.slice(0, 2).map((o, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                      <span className="text-emerald-400 text-xs font-black">{i + 1}</span>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-emerald-400">Escalar</h5>
                      <p className="text-[10px] text-zinc-500 mt-0.5">"{o.name}" — CPL {fmtMoney(o.cpl)}, Score {o.score}.</p>
                    </div>
                  </li>
                ))}
                {scaleOpportunities.length === 0 && criticalAlerts.length === 0 && (
                  <li className="text-xs text-zinc-500">Clique em "Gerar Análise Profunda" para obter recomendações detalhadas via IA.</li>
                )}
                {criticalAlerts.length > 0 && scaleOpportunities.length === 0 && (
                  <li className="flex gap-3">
                    <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
                      <span className="text-red-400 text-xs font-black">!</span>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-red-400">Revisar</h5>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{criticalAlerts.length} campanha(s) com CPL critico. Considere pausar ou ajustar.</p>
                    </div>
                  </li>
                )}
              </ul>
            )}
           </SpotlightCard>
        </div>
      </div>

      {/* Modal Score Breakdown */}
      <Dialog open={scoreModalOpen} onOpenChange={setScoreModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Como o Score da Conta é calculado?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-xs text-zinc-400">
              O score é uma média ponderada por investimento dos scores individuais de cada campanha ativa no período.
              Cada campanha é avaliada em 3 dimensões:
            </p>
            {Object.entries(scoreBreakdown).map(([key, dim]) => {
              const barWidth = Math.min(100, Math.max(5, dim.peso));
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-zinc-300">{dim.label}</span>
                    <span className="text-zinc-500">Peso: {dim.peso}%</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Valor atual: {key === "cpl" ? fmtMoney(dim.valor) : key === "ctr" ? `${dim.valor.toFixed(2)}%` : `${dim.valor.toFixed(1)}x`}
                  </p>
                </div>
              );
            })}
            <div className="bg-zinc-800/50 border border-zinc-700/30 rounded-lg p-3 mt-3">
              <p className="text-[10px] text-zinc-400">
                <strong className="text-zinc-300">Score final: {accountScore ?? "—"}/100</strong>
                {" — "}
                {accountScore != null && accountScore >= 70
                  ? "Performance boa. Manter e otimizar."
                  : accountScore != null && accountScore >= 40
                    ? "Performance moderada. Revisar criativos e segmentação."
                    : "Performance baixa. Ação corretiva necessária."}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


