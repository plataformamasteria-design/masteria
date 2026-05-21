"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Check, ChevronRight, ChevronLeft, X,
  Loader2, AlertCircle, CheckCircle2, Search,
  DollarSign, PlusCircle, Target, MousePointerClick,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import TreeBuilder, { CampaignNodeTree, AdSetNode, AdNode, makeAdSet } from "./tree-builder";
import { buildInitialTreeFromMeta } from "./tree-utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Campaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED";
  objective: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  spend: number;
  leads: number;
  cpl: number | null;
}

const OBJECTIVE_PT: Record<string, string> = {
  OUTCOME_LEADS: "Geração de Leads",
  OUTCOME_SALES: "Vendas",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_APP_PROMOTION: "App",
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// buildInitialTreeFromMeta importado de ./tree-utils.ts

// ── Mode Selection ─────────────────────────────────────────────────────────────
function StepModeSelection({ onSelect }: { onSelect: (m: "scratch" | "duplicate") => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelect("duplicate")}
        className="cursor-pointer group relative overflow-hidden rounded-2xl border border-border bg-black/5 dark:bg-white/5 p-8 hover:border-accent/50 hover:bg-black/10 dark:hover:bg-black/10 dark:bg-white/10 transition-all flex flex-col items-center text-center"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="h-16 w-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mb-6">
          <Copy className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Duplicar Existente</h3>
        <p className="text-sm text-foreground/90">
          Clone a estrutura perfeita de uma campanha campeã (Públicos, Conjuntos e Anúncios). Mais rápido e a prova de falhas.
        </p>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelect("scratch")}
        className="cursor-pointer group relative overflow-hidden rounded-2xl border border-border bg-black/5 dark:bg-white/5 p-8 hover:border-primary/20 hover:bg-black/10 dark:hover:bg-black/10 dark:bg-white/10 transition-all flex flex-col items-center text-center"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6">
          <PlusCircle className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Criar do Zero</h3>
        <p className="text-sm text-foreground/90">
          Assistente de arquitetura para desenhar a campanha, segmentação e anúncios exatamente com seu novo objetivo.
        </p>
      </motion.div>
    </div>
  );
}

// ── Duplicate: Step 0 — Select Existing Campaign ────────────────────────────────
function StepSelectCampaign({
  selected, onSelect
}: {
  selected: Campaign | null; onSelect: (c: Campaign) => void;
}) {
  const { data, isLoading } = useSWR<{ data: Campaign[] }>("/api/meta/campanhas", fetcher, { revalidateOnFocus: false });
  const [search, setSearch] = useState("");

  const campaigns = (data?.data || []).filter(c =>
    c.status !== "DELETED" && c.status !== "ARCHIVED" && (!search || c.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4 w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/90" />
        <Input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar campanhas..."
          className="pl-9 bg-black/5 dark:bg-white/8 border-border text-foreground"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-4 w-4 animate-spin text-foreground/90" /></div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {campaigns.map((c) => (
            <motion.button
              key={c.id} onClick={() => onSelect(c)}
              whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.99 }}
              className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                selected?.id === c.id ? "border-accent/60 bg-primary/10" : "border-border bg-white/4 border-border"
              }`}
            >
              <div className={`h-2 w-2 rounded-full shrink-0 ${c.status === "ACTIVE" ? "bg-accent" : "bg-zinc-600"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                <p className="text-xs text-foreground/90 mt-0.5">{OBJECTIVE_PT[c.objective] || c.objective} · {c.daily_budget ? fmt(c.daily_budget) + "/dia" : "Vitalício"}</p>
              </div>
              {selected?.id === c.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Duplicate: Step 1 — Loading Source Tree ─────────────────────────────────────
function StepDuplicating({ sourceName }: { sourceName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="h-20 w-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
        <RefreshCw className="h-10 w-10 text-primary animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-xl font-bold text-foreground mb-2">Carregando estrutura...</p>
        <p className="text-sm text-foreground/90 max-w-sm">Buscando conjuntos e anúncios de <strong className="text-primary">{sourceName}</strong> para pré-preencher o editor.</p>
      </div>
    </div>
  );
}

// ── Wrapper & Engine ────────────────────────────────────────────────────────────
export function CriarCampanhaDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<"scratch" | "duplicate" | null>(null);

  // Duplicate States
  // dupPhase: 0=select, 1=loading source tree, 2=editing(TreeBuilder)
  const [dupPhase, setDupPhase] = useState<0 | 1 | 2>(0);
  const [source, setSource] = useState<Campaign | null>(null);
  const [initialTree, setInitialTree] = useState<CampaignNodeTree | null>(null);

  const [errorMsg, setErrorMsg] = useState("");

  const handleDuplicate = useCallback(async () => {
    if (!source) return;
    setDupPhase(1);
    setErrorMsg("");

    try {
      // Estratégia sem deep_copy: busca a árvore original e recria do zero
      // Evita o limite da Meta API (subcode 1885194: total de objetos deve ser < 3)

      // Step 1: Carrega a estrutura original da campanha (adsets + ads)
      const treeRes = await fetch(`/api/meta/campaign-tree?campaign_id=${source.id}&t=${Date.now()}`);
      const treeData = treeRes.ok ? await treeRes.json() : { data: [] };
      const adsetsRaw: any[] = treeData.data || [];

      // Step 2: Monta a árvore editável baseada na campanha original
      // Os metaIds NÃO são incluídos — será criada como nova campanha
      const built = buildInitialTreeFromMeta(source, adsetsRaw);
      built.metaCampaignId = undefined; // Força criação, não edição

      setInitialTree(built);
      setDupPhase(2);
    } catch (e: any) {
      setErrorMsg(e.message);
      setDupPhase(0);
    }
  }, [source]);

  const isScratch = mode === "scratch";

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="fixed inset-0 bg-black/5 dark:bg-black/5 dark:bg-black/60 backdrop-blur-md z-[9999]" onClick={onClose} />
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="w-full max-w-[1240px] max-h-[92vh] bg-background rounded-2xl border border-border shadow-2xl flex flex-col pointer-events-auto overflow-hidden"
        >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-border bg-background flex items-start justify-between">
          <div>
            {!mode ? (
              <h2 className="text-xl font-bold text-foreground tracking-tight">Nova Campanha</h2>
            ) : (
              <div>
                <button
                  onClick={() => { setMode(null); setDupPhase(0); setSource(null); setInitialTree(null); setErrorMsg(""); }}
                  className="text-[10px] font-semibold uppercase tracking-wider text-foreground/90 hover:text-foreground transition-colors flex items-center gap-1 mb-1.5 focus:outline-none"
                >
                  <ChevronLeft className="h-3 w-3" /> Alterar Modo
                </button>
                <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-3">
                  {isScratch ? "Criar do Zero" : dupPhase === 2 ? "Editar Cópia Duplicada" : "Nova via Duplicação"}
                  {isScratch && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] border border-primary/20">Avançado</span>}
                  {!isScratch && dupPhase === 2 && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] border border-primary/20">Edição Pós-Duplicação</span>}
                </h2>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-black/10 dark:bg-white/10 rounded-full text-foreground/90 hover:text-foreground transition-colors flex-shrink-0 focus:outline-none">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        {!mode ? (
          <div className="p-6 flex-1 bg-background">
            <p className="text-foreground/90 text-sm">Escolha seu fluxo de trabalho preferido.</p>
            <StepModeSelection onSelect={setMode} />
          </div>
        ) : isScratch ? (
          <div className="flex-1 min-h-0 bg-background flex flex-col items-stretch overflow-hidden">
            <TreeBuilder onFinish={() => { onCreated(); onClose(); }} />
          </div>
        ) : (
          // ── Duplicate flow ──
          <div className="flex flex-col flex-1 bg-background overflow-hidden">
            {/* Error banner */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-6 mt-5 rounded-xl border border-primary/20 bg-primary/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="text-sm font-medium text-primary">{errorMsg}</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Phase 0: Select campaign */}
            {dupPhase === 0 && (
              <>
                <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
                  <p className="text-sm text-foreground/90 mb-4">Selecione a campanha que deseja duplicar e editar:</p>
                  <StepSelectCampaign selected={source} onSelect={setSource} />
                </div>
                <div className="p-5 border-t border-border bg-background flex justify-end items-center flex-shrink-0">
                  <Button
                    onClick={handleDuplicate}
                    disabled={!source}
                    className="bg-accent hover:bg-accent text-foreground font-bold border-0 h-11 px-8 rounded-xl"
                  >
                    <Copy className="h-4 w-4 mr-2" /> Duplicar e Editar
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </>
            )}

            {/* Phase 1: Duplicating */}
            {dupPhase === 1 && (
              <div className="flex-1 overflow-y-auto px-6">
                <StepDuplicating sourceName={source?.name || ""} />
              </div>
            )}

            {/* Phase 2: TreeBuilder em modo CRIAÇÃO com dados pré-populados */}
            {dupPhase === 2 && initialTree && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="mx-6 mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-accent/8 border border-accent/15 flex-shrink-0">
                  <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-accent/70 leading-relaxed">
                    Estrutura pré-preenchida com base em <strong className="text-primary">{source?.name}</strong>. Edite o que desejar (nome, budget, criativos, público) e clique em <strong>Publicar Campanha</strong> para criar a nova campanha no Meta.
                  </p>
                </div>
                <TreeBuilder
                  editMode={false}
                  initialTree={initialTree}
                  onFinish={() => { onCreated(); onClose(); }}
                />
              </div>
            )}
          </div>
        )}
        </motion.div>
      </div>
    </>,
    document.body
  );
}
