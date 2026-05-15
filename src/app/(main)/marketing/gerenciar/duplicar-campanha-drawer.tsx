"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, RefreshCw, AlertCircle, Copy, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TreeBuilder, { CampaignNodeTree } from "./tree-builder";
import { buildInitialTreeFromMeta } from "./tree-utils";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface DupCampaignSource {
  id: string;
  name: string;
  objective: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  status?: string;
}

interface DuplicarCampanhaDrawerProps {
  sourceCampaign: DupCampaignSource;
  onClose: () => void;
  onCreated: () => void;
}

// ── Phase 1: Loading Animation ──────────────────────────────────────────────────
function PhaseCarregando({ sourceName }: { sourceName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="relative">
        <div className="h-24 w-24 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <RefreshCw className="h-12 w-12 text-primary animate-spin" />
        </div>
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 rounded-full border border-primary/20"
        />
      </div>
      <div className="text-center space-y-2">
        <p className="text-xl font-bold text-foreground tracking-tight">
          Carregando estrutura...
        </p>
        <p className="text-sm text-foreground/60 max-w-sm leading-relaxed">
          Buscando conjuntos e anúncios de{" "}
          <strong className="text-primary">{sourceName}</strong> para
          pré-preencher o editor.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-foreground/40 font-mono">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        campaign-tree · sem limite de objetos
      </div>
    </div>
  );
}

// ── Main Drawer ─────────────────────────────────────────────────────────────────
export function DuplicarCampanhaDrawer({
  sourceCampaign,
  onClose,
  onCreated,
}: DuplicarCampanhaDrawerProps) {
  type Phase = "loading" | "editing" | "error";

  const [phase, setPhase] = useState<Phase>("loading");
  const [initialTree, setInitialTree] = useState<CampaignNodeTree | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  /**
   * Estratégia sem deep_copy:
   * Busca a estrutura da campanha original via campaign-tree e abre o TreeBuilder
   * em modo de CRIAÇÃO (editMode=false). Ao salvar, cria uma nova campanha do zero.
   * Isso contorna o limite da Meta API (subcode 1885194: total objetos < 3).
   */
  const loadSourceTree = useCallback(async () => {
    setPhase("loading");
    setErrorMsg("");

    try {
      // Carrega adsets + ads da campanha original
      const res = await fetch(
        `/api/meta/campaign-tree?campaign_id=${sourceCampaign.id}&t=${Date.now()}`
      );
      const data = res.ok ? await res.json() : { data: [] };
      const adsetsRaw: any[] = data.data || [];

      // Constrói a árvore SEM metaIds → força criação nova
      const built = buildInitialTreeFromMeta(sourceCampaign, adsetsRaw);
      built.metaCampaignId = undefined; // Garante modo criação

      setInitialTree(built);
      setPhase("editing");
    } catch (e: any) {
      setErrorMsg(e.message);
      setPhase("error");
    }
  }, [sourceCampaign]);

  useEffect(() => {
    loadSourceTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 bg-black/65 backdrop-blur-md z-[9999]"
        onClick={phase === "editing" ? undefined : onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 24 }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="w-full max-w-[1240px] max-h-[93vh] bg-[#09090b] rounded-2xl border border-white/10 shadow-2xl flex flex-col pointer-events-auto overflow-hidden"
        >
          {/* Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-white/5 bg-zinc-950 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Copy className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  Duplicar Campanha
                </span>
                {phase === "editing" && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] border border-primary/20">
                    Editar antes de publicar
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-foreground tracking-tight truncate max-w-[700px]">
                {phase === "loading" && "Carregando estrutura..."}
                {phase === "editing" &&
                  `Duplicar "${sourceCampaign.name}"`}
                {phase === "error" && "Falha ao carregar estrutura"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-foreground/60 hover:text-foreground transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 bg-[#09090b] flex flex-col overflow-hidden">
            <AnimatePresence mode="wait">

              {/* Phase: loading */}
              {phase === "loading" && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 overflow-y-auto px-6"
                >
                  <PhaseCarregando sourceName={sourceCampaign.name} />
                </motion.div>
              )}

              {/* Phase: Error */}
              {phase === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center gap-6 px-8 py-16"
                >
                  <div className="h-20 w-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <AlertCircle className="h-10 w-10 text-primary" />
                  </div>
                  <div className="text-center space-y-2 max-w-sm">
                    <p className="text-lg font-bold text-foreground">
                      Não foi possível carregar a estrutura
                    </p>
                    <p className="text-sm text-primary font-mono bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 text-left">
                      {errorMsg}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="ghost"
                      onClick={onClose}
                      className="text-foreground/60 hover:text-foreground"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={loadSourceTree}
                      className="bg-accent hover:bg-accent text-foreground font-bold border-0 gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Tentar Novamente
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Phase: Editing — TreeBuilder em modo CRIAÇÃO */}
              {phase === "editing" && initialTree && (
                <motion.div
                  key="editing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 min-h-0 flex flex-col overflow-hidden"
                >
                  {/* Info banner */}
                  <div className="mx-6 mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-accent/8 border border-accent/15 flex-shrink-0">
                    <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-accent/70 leading-relaxed">
                      Estrutura pré-preenchida com base em{" "}
                      <strong className="text-primary">
                        {sourceCampaign.name}
                      </strong>
                      . Edite o que desejar (nome, budget, criativos, público)
                      e clique em <strong>Publicar Campanha</strong> para
                      criar a nova campanha no Meta.
                    </p>
                  </div>

                  <TreeBuilder
                    editMode={false}
                    initialTree={initialTree}
                    onFinish={() => {
                      onCreated();
                      onClose();
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </>,
    document.body
  );
}
