"use client";

/**
 * GlobalIntelligence — Visão de Cluster com dados reais do banco.
 * Usa useSWR em vez de useEffect+fetch (MASTER RULE §2.4).
 * Cards com SpotlightCard para consistência visual com as demais abas.
 */
import useSWR from "swr";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CopyCheck, BrainCircuit, Activity, Bot,
  ChevronDown, Check, X, SlidersHorizontal, Loader2,
  Flame, AlertTriangle, Shield, TrendingUp, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { AnimatePresence } from "framer-motion";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface BatchItem {
  id: string; account_id: string; account_name: string;
  diagnosis: string; suggested_action: string;
  confidence_level: "alta" | "media" | "baixa";
  status: "pending" | "approved" | "rejected" | "adjusted";
}

interface BatchAction {
  id: string; title: string; niche: string;
  general_diagnosis: string;
  status: "pending" | "approved" | "rejected" | "partially_approved";
  ad_intelligence_batch_items: BatchItem[];
  created_at: string;
}

interface Stats {
  contas_total: number; contas_em_risco: number;
  contas_estaveis: number; contas_escala: number;
  critical: number; high: number; total_alerts: number;
  last_sync_at: string | null;
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 0 || Number.isNaN(diffMs)) return "—";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
}

interface GlobalIntelligenceProps {
  since: string;
  until: string;
}

export function GlobalIntelligence({ since, until }: GlobalIntelligenceProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  // Stats reais do banco (SWR — auto-refresh a cada 60s)
  const { data: statsData, isLoading: statsLoading, mutate: mutateStats } = useSWR<Stats>(
    "/api/ad-intelligence/stats",
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 60000 }
  );

  // Lotes de ações (SWR)
  const { data: batchData, isLoading: batchLoading, mutate: mutateBatches } = useSWR(
    "/api/ad-intelligence/batch-action",
    fetcher,
    { revalidateOnFocus: false }
  );

  const batches: BatchAction[] = batchData?.batches || [];
  const stats = statsData;

  async function generateClusterReport() {
    setAnalyzing(true);
    toast.info("Analisando todas as contas conectadas...");
    try {
      const res = await fetch("/api/ad-intelligence/cluster-analysis", { method: "POST" });
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else {
        toast.success(`Análise concluída. ${data.created_batches} novos lotes gerados.`);
        mutateBatches();
        mutateStats();
      }
    } catch {
      toast.error("Erro na API da IA de Cluster.");
    }
    setAnalyzing(false);
  }

  async function resolveBatch(batchId: string, action: "approve_all" | "reject_all") {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return;
    const payload = {
      batch_id: batchId,
      global_status: action === "approve_all" ? "approved" : "rejected",
      items: batch.ad_intelligence_batch_items.map(i => ({
        id: i.id,
        status: action === "approve_all" ? "approved" : "rejected",
      })),
    };
    try {
      const res = await fetch("/api/ad-intelligence/batch-action", {
        method: "POST", body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("Lote resolvido com sucesso.");
        mutateBatches();
        await fetch("/api/ad-intelligence/memory", {
          method: "POST",
          body: JSON.stringify({
            context_type: "global",
            learning_text: `Gestor ${action === "approve_all" ? "aprovou" : "rejeitou"} a regra: ${batch.general_diagnosis}`,
          }),
        });
      }
    } catch {
      toast.error("Erro ao resolver lote");
    }
  }

  // ── HUD Cards config ───────────────────────────────────────────────────────
  const HUD_CARDS = [
    {
      label: "Contas Gerenciadas",
      value: stats?.contas_total ?? null,
      icon: Shield,
      cls: "text-zinc-300",
      border: "border-border",
    },
    {
      label: "Em Risco",
      value: stats?.contas_em_risco ?? null,
      icon: Flame,
      cls: stats?.contas_em_risco ? "text-destructive" : "text-zinc-500",
      border: stats?.contas_em_risco ? "border-destructive/20" : "border-border",
    },
    {
      label: "Estáveis",
      value: stats?.contas_estaveis ?? null,
      icon: TrendingUp,
      cls: "text-primary",
      border: "border-primary/10",
    },
    {
      label: "Oportunidade Escala",
      value: stats?.contas_escala ?? null,
      icon: Activity,
      cls: "text-primary",
      border: "border-accent/10",
    },
  ];

  const pendingBatches = batches.filter(b => b.status === "pending");

  return (
    <div className="space-y-6">
      {/* ── HUD de Estatísticas ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {HUD_CARDS.map((card) => {
          const CardIcon = card.icon;
          return (
            <SpotlightCard
              key={card.label}
              className={cn("p-5 lg:p-6 flex flex-col justify-between", card.border)}
            >
              <div className="flex justify-between items-start mb-5">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-foreground/60">
                  {card.label}
                </span>
                <CardIcon className={cn("h-4 w-4", card.cls)} />
              </div>
              {statsLoading ? (
                <div className="h-10 w-16 rounded-lg bg-black/5 dark:bg-white/5 animate-pulse" />
              ) : (
                <p className={cn("text-4xl lg:text-5xl font-black tracking-tighter", card.cls)}>
                  {card.value ?? "—"}
                </p>
              )}
            </SpotlightCard>
          );
        })}
      </div>

      {/* Alert summary inline */}
      {stats && stats.total_alerts > 0 && (
        <div className="flex flex-wrap gap-3">
          {stats.critical > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-xs font-bold">
              <Flame className="h-4 w-4" /> {stats.critical} alertas críticos
            </div>
          )}
          {stats.high > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/20 bg-accent/5 text-primary text-xs font-bold">
              <AlertTriangle className="h-4 w-4" /> {stats.high} alertas altos
            </div>
          )}
          {stats.last_sync_at && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-white/[0.02] text-zinc-500 text-xs ml-auto">
              <RefreshCw className="h-3.5 w-3.5" />
              Último sync: {formatRelativeTime(stats.last_sync_at)}
            </div>
          )}
        </div>
      )}

      {/* ── Painel de Ações em Lote ─────────────────────────────────────── */}
      <SpotlightCard className="border-border">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Ações em Lote Inteligentes
            </h3>
            <p className="text-[11px] text-zinc-500 mt-1">
              A IA aprende com os padrões do cluster e decisões tomadas.
            </p>
          </div>
          <button
            onClick={generateClusterReport}
            disabled={analyzing}
            className="flex items-center gap-2 bg-accent hover:bg-accent text-foreground text-[11px] font-bold tracking-widest uppercase px-4 py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(0,153,255,0.2)] disabled:opacity-50 shrink-0"
          >
            {analyzing
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Activity className="h-3.5 w-3.5" />
            }
            {analyzing ? "Analisando..." : "Gerar Análise Global"}
          </button>
        </div>

        <div className="p-4">
          {batchLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-white/[0.02] animate-pulse" />
              ))}
            </div>
          ) : pendingBatches.length === 0 ? (
            <div className="text-center py-16">
              <CopyCheck className="h-10 w-10 mx-auto mb-3 text-zinc-600" />
              <p className="text-sm text-zinc-500">Nenhuma ação em lote pendente.</p>
              <p className="text-[11px] text-zinc-600 mt-1">
                Gere uma nova análise para identificar padrões no cluster.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingBatches.map(batch => {
                const isExpanded = expandedBatch === batch.id;
                return (
                  <div
                    key={batch.id}
                    className="rounded-xl border border-primary/20 bg-accent/5 overflow-hidden"
                  >
                    <div
                      className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => setExpandedBatch(isExpanded ? null : batch.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[9px] px-2 py-0.5 rounded border border-primary/20 bg-primary/10 text-primary font-bold uppercase tracking-widest">
                              Cluster Lote
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              Nicho: {batch.niche}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold mb-1">{batch.title}</h4>
                          <p className="text-xs text-zinc-400">{batch.general_diagnosis}</p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 ml-4">
                          <div className="text-right">
                            <span className="text-2xl font-black text-primary block leading-none">
                              {batch.ad_intelligence_batch_items.length}
                            </span>
                            <span className="text-[9px] uppercase tracking-widest text-zinc-500">contas</span>
                          </div>
                          <ChevronDown
                            className={cn("h-5 w-5 text-zinc-500 transition-transform", isExpanded && "rotate-180")}
                          />
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-accent/10 bg-black/5 dark:bg-black/20"
                        >
                          <div className="p-4 space-y-3">
                            <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-3">
                              Contexto Individual (Conta a Conta)
                            </p>
                            {batch.ad_intelligence_batch_items.map(item => (
                              <div
                                key={item.id}
                                className="bg-card/60 border border-border rounded-xl p-4 flex gap-4"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <h5 className="text-sm font-bold text-primary">{item.account_name}</h5>
                                    <span className={cn(
                                      "text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-widest",
                                      item.confidence_level === "alta"
                                        ? "border-primary/20 bg-primary/10 text-primary"
                                        : item.confidence_level === "media"
                                        ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                                        : "border-zinc-700 bg-muted text-zinc-400"
                                    )}>
                                      Confiança {item.confidence_level.toUpperCase()}
                                    </span>
                                  </div>
                                  <p className="text-xs text-zinc-400 mb-2">
                                    <span className="font-semibold text-zinc-300">Diagnóstico: </span>
                                    {item.diagnosis}
                                  </p>
                                  <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                                    <span className="text-[9px] text-primary font-bold uppercase tracking-widest block mb-1">
                                      Sugestão de Ação
                                    </span>
                                    <p className="text-xs text-accent/70">{item.suggested_action}</p>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2 shrink-0">
                                  <button
                                    title="Remover conta do lote"
                                    className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 border border-border hover:bg-destructive/10 hover:border-destructive/20 hover:text-destructive text-zinc-500 flex items-center justify-center transition-all"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    title="Ajustar instrução"
                                    className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 border border-border hover:bg-black/10 dark:hover:bg-black/10 dark:bg-white/10 text-zinc-500 hover:text-foreground flex items-center justify-center transition-all"
                                  >
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}

                            <div className="flex justify-between items-center pt-4 border-t border-border">
                              <button
                                onClick={() => resolveBatch(batch.id, "reject_all")}
                                className="text-xs text-zinc-500 hover:text-destructive px-3 py-2 transition-colors"
                              >
                                Rejeitar Lote
                              </button>
                              <button
                                onClick={() => resolveBatch(batch.id, "approve_all")}
                                className="flex items-center gap-2 bg-accent hover:bg-accent text-foreground text-[11px] font-bold tracking-widest uppercase px-4 py-2.5 rounded-xl transition-all"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Aprovar & Marcar Contas
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SpotlightCard>
    </div>
  );
}
