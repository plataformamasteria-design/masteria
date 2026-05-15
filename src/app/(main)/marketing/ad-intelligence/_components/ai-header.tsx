"use client";

import { useAdIntelligence } from "./ai-context";
import { useAdAccount } from "@/contexts/ad-account-context";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { RefreshCw, Filter, CalendarDays, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { ALL_PROVIDERS, AI_LABELS, getAIProvider, setAIProvider } from "@/lib/ai-config";
import type { AIProvider } from "@/lib/ai-client";

export function AdIntelligenceHeader() {
  const { account } = useAdAccount();
  const accountId = account?.id || "";
  const displayId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  
  const {
    objectiveFilter, setObjectiveFilter,
    statusFilter, setStatusFilter,
    fullReport, setFullReport, period, isGenerating, setIsGenerating
  } = useAdIntelligence();

  const headerParams = new URLSearchParams({ since: period.since, until: period.until, level: "campaign" });
  if (accountId) headerParams.set("account_id", accountId);
  const { data: rawData } = useSWR(`/api/meta/insights?${headerParams.toString()}`, url => fetch(url).then(r => r.json()));

  const PRESETS = [
    { id: "today", label: "Hoje" },
    { id: "yesterday", label: "Ontem" },
    { id: "7d", label: "7 Dias" },
    { id: "14d", label: "14 Dias" },
    { id: "30d", label: "30 Dias" },
    { id: "custom", label: "Customizado" }
  ];

  const AI_LS_KEY = "ai_provider_command_center";
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>("gemini");
  const [confirmModal, setConfirmModal] = useState(false);
  const [lastUsedProvider, setLastUsedProvider] = useState<AIProvider | null>(null);
  const [lastDuration, setLastDuration] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(AI_LS_KEY);
    if (saved && ALL_PROVIDERS.includes(saved as AIProvider)) {
      setSelectedProvider(saved as AIProvider);
    }
  }, []);

  const handleProviderChange = (provider: AIProvider) => {
    setSelectedProvider(provider);
    localStorage.setItem(AI_LS_KEY, provider);
  };

  const handleGenerateAI = async () => {
    setConfirmModal(false);
    setIsGenerating(true);
    setLastUsedProvider(selectedProvider);
    const startTime = Date.now();
    try {
      const res = await fetch("/api/meta/ad-intelligence/diagnose", {
        method: "POST", body: JSON.stringify({ metrics: rawData?.data || [], provider: selectedProvider })
      });
      const data = await res.json();
      setLastDuration((Date.now() - startTime) / 1000);
      setFullReport(data);
    } catch(e) {
      console.error(e);
      alert("Falha ao se conectar com a IA");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
    <SpotlightCard className="p-4 flex flex-col gap-4 border-white/5 bg-black/20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tighter flex items-center gap-2">
            <span className="text-primary">⚡</span> AI Command Center {account?.name ? `- ${account.name}` : ''}
          </h2>
          <p className="text-xs text-foreground/50 font-mono mt-0.5">{displayId}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            <select
              value={selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
              className="bg-black/40 border border-white/10 rounded-lg text-xs px-3 py-1.5 outline-none text-foreground/90 font-medium min-w-[180px]"
            >
              {ALL_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {AI_LABELS[p].nome}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setConfirmModal(true)}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs font-bold text-primary transition-colors"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isGenerating ? "Processando IA Global..." : "Gerar Análise Profunda"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center pt-4 border-t border-white/5">

        {/* Period is now controlled by the global selector in the layout */}
        <div className="flex items-center gap-2 text-xs text-foreground/50">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span>Período: <strong className="text-foreground/80">{period.since}</strong> → <strong className="text-foreground/80">{period.until}</strong></span>
        </div>

        {/* Objective Filters */}
        <div className="flex items-center gap-2 ml-auto">
          <Filter className="h-4 w-4 text-primary" />
          <select 
            value={objectiveFilter} 
            onChange={(e) => setObjectiveFilter(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg text-xs px-3 py-1.5 outline-none text-foreground/90 font-medium"
          >
            <option value="all">🚀 Todos os Objetivos</option>
            <option value="LEAD_GENERATION">🎯 Leads</option>
            <option value="CONVERSIONS">🛒 Conversões</option>
            <option value="MESSAGES">💬 Mensagens</option>
            <option value="LINK_CLICKS">🔗 Tráfego</option>
          </select>

          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg text-xs px-3 py-1.5 outline-none text-foreground/90 font-medium"
          >
            <option value="all">🟢 Todos os Status</option>
            <option value="ACTIVE">🟢 Apenas Ativos</option>
            <option value="PAUSED">⚪ Pausados</option>
            <option value="WITH_ALERT">🚨 Com Alerta Crítico</option>
          </select>
        </div>

      </div>
    </SpotlightCard>
    
    {lastUsedProvider && fullReport && !isGenerating && (
      <div className="mt-2 px-4 py-2 bg-black/30 border border-white/5 rounded-lg flex items-center justify-center gap-3 text-[11px] text-zinc-500 font-mono">
        <span>Analisado com <strong className="text-foreground/70">{AI_LABELS[lastUsedProvider].nome}</strong></span>
        {lastDuration !== null && (
          <>
            <span>·</span>
            <span>Duração {lastDuration.toFixed(1)}s</span>
          </>
        )}
      </div>
    )}

    {confirmModal && (
      <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
         <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col items-center text-center">
            <Sparkles className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-lg font-black text-foreground">Sincronizar Inteligência de Conta?</h3>
            <p className="text-sm text-zinc-400 mt-2">
               Você está prestes a processar toda a base dessa conta usando <strong className="text-foreground">{AI_LABELS[selectedProvider].nome}</strong>. O relatório servirá todas as abas.
            </p>
            <div className="flex gap-3 w-full mt-6">
              <button onClick={() => setConfirmModal(false)} className="flex-1 bg-white/5 text-zinc-400 py-3 rounded-lg font-bold text-xs">Cancelar</button>
              <button 
                 onClick={handleGenerateAI}
                 className="flex-1 bg-accent hover:bg-accent text-white shadow-lg shadow-primary/20 py-3 rounded-lg font-bold text-xs"
              >
                 Executar Análise IA
              </button>
            </div>
         </div>
      </div>
    )}
    </>
  );
}
