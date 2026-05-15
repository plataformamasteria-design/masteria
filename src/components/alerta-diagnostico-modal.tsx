"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Copy, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ALL_PROVIDERS, AI_LABELS, getAIProvider } from "@/lib/ai-config";
import type { AIProvider } from "@/lib/ai-client";

interface PerfDiario {
  data_ref: string;
  spend: number;
  leads: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpl: number;
  frequencia: number;
}

export interface AlertaDiagnosticoData {
  tipo: string;
  severidade: string;
  adNome: string;
  campanhaNome: string;
  valorAtual: string;
  threshold: string;
  spend30d: number;
  leads30d: number;
  cpl30d: number;
  ctr3d: number;
  freqMedia7d: number;
  spend2d: number;
  leads2d: number;
  perfDiario: PerfDiario[];
}

const PROVIDER_MODELS: Record<string, string> = {
  "gemini": "Gemini 2.0 Flash",
  "openai-mini": "GPT-4o Mini",
  "anthropic-haiku": "Claude Haiku 4.5",
  "anthropic": "Claude Sonnet 4",
  "openai": "GPT-4o",
};

function buildPrompt(a: AlertaDiagnosticoData): string {
  const tipoLabel: Record<string, string> = {
    cpl_max: "CPL acima do limite",
    ctr_min: "CTR abaixo do mínimo",
    frequencia_max: "Frequência de exibição alta",
    zero_leads: "Zero leads com gasto ativo",
  };

  let prompt = `ALERTA: ${tipoLabel[a.tipo] || a.tipo}
Anúncio: ${a.adNome}
Campanha: ${a.campanhaNome}
Severidade: ${a.severidade}
Valor atual: ${a.valorAtual}
Threshold: ${a.threshold}

MÉTRICAS (últimos 30 dias):
- Investimento total: R$ ${a.spend30d.toFixed(2)}
- Leads gerados: ${a.leads30d}
- CPL médio: R$ ${a.cpl30d.toFixed(2)}
- CTR últimos 3 dias: ${a.ctr3d.toFixed(2)}%
- Frequência média (7d): ${a.freqMedia7d.toFixed(1)}x
- Gasto últimas 48h: R$ ${a.spend2d.toFixed(2)}
- Leads últimas 48h: ${a.leads2d}`;

  if (a.perfDiario.length > 0) {
    prompt += "\n\nHISTÓRICO DIÁRIO (últimos dias):";
    prompt += "\nData | Spend | Leads | CPL | CTR | Freq";
    a.perfDiario.slice(0, 14).forEach((d) => {
      const cplStr = d.leads > 0 ? `R$ ${(d.spend / d.leads).toFixed(2)}` : "—";
      prompt += `\n${d.data_ref} | R$ ${d.spend.toFixed(2)} | ${d.leads} | ${cplStr} | ${d.ctr.toFixed(2)}% | ${d.frequencia.toFixed(1)}x`;
    });
  }

  return prompt;
}

function parseMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: { type: "h2" | "p" | "li"; content: string }[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("## ")) elements.push({ type: "h2", content: trimmed.slice(3) });
    else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) elements.push({ type: "li", content: trimmed.slice(2) });
    else elements.push({ type: "p", content: trimmed });
  }
  return elements;
}

function extractUrgencia(text: string): { label: string; color: string } | null {
  if (text.includes("CRÍTICO")) return { label: "CRÍTICO", color: "bg-red-500/20 text-red-400" };
  if (text.includes("ATENÇÃO")) return { label: "ATENÇÃO", color: "bg-yellow-500/20 text-yellow-400" };
  if (text.includes("TOLERÁVEL")) return { label: "TOLERÁVEL", color: "bg-green-500/20 text-green-400" };
  return null;
}

export function AlertaDiagnosticoModal({
  open,
  onClose,
  alerta,
}: {
  open: boolean;
  onClose: () => void;
  alerta: AlertaDiagnosticoData | null;
}) {
  const [estado, setEstado] = useState<"idle" | "loading" | "resultado">("idle");
  const [diagnostico, setDiagnostico] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider>(() => getAIProvider("diagnostico_alerta"));
  const [aiStatus, setAiStatus] = useState<Record<string, "ok" | "sem_creditos" | "erro" | "sem_chave" | "loading">>({});

  // Buscar status das IAs e auto-analisar quando abre
  useEffect(() => {
    if (open && alerta) {
      // Buscar status
      fetch("/api/ai-status").then((r) => r.json()).then((data) => {
        const map: Record<string, "ok" | "sem_creditos" | "erro" | "sem_chave"> = {};
        for (const p of (data.providers || [])) {
          map[p.provider] = p.status;
          // Mapear para sub-providers
          if (p.provider === "anthropic") { map["anthropic-haiku"] = p.status; map["anthropic"] = p.status; }
          if (p.provider === "openai") { map["openai-mini"] = p.status; map["openai"] = p.status; }
          if (p.provider === "gemini") { map["gemini"] = p.status; }
        }
        setAiStatus(map);
      }).catch(() => {});
      // Auto-analisar
      if (estado === "idle") analisar();
    }
  }, [open, alerta]);

  async function analisar() {
    if (!alerta) return;
    setEstado("loading");
    setErro(null);

    try {
      const res = await fetch("/api/alerta-diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertaData: buildPrompt(alerta),
          provider,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setErro(data.error);
        setEstado("idle");
      } else {
        setDiagnostico(data.diagnostico);
        setEstado("resultado");
      }
    } catch {
      setErro("Não foi possível gerar o diagnóstico. Tente novamente.");
      setEstado("idle");
    }
  }

  function fechar() {
    setEstado("idle");
    setDiagnostico("");
    setErro(null);
    onClose();
  }

  function trocarProvider(p: AIProvider) {
    setProvider(p);
    localStorage.setItem("ai_provider_diagnostico_alerta", p);
    if (estado === "resultado") {
      setEstado("idle");
      setDiagnostico("");
      setTimeout(() => analisar(), 100);
    }
  }

  function copiar() {
    navigator.clipboard.writeText(diagnostico);
    toast.success("Diagnóstico copiado!");
  }

  const urgencia = diagnostico ? extractUrgencia(diagnostico) : null;
  const parsed = diagnostico ? parseMarkdown(diagnostico) : [];

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Brain size={18} className="text-purple-400" />
              Diagnóstico por IA
              {urgencia && <Badge className={`text-xs ${urgencia.color}`}>{urgencia.label}</Badge>}
            </DialogTitle>
            {/* Seletor de provider */}
            <div className="relative">
              <select
                value={provider}
                onChange={(e) => trocarProvider(e.target.value as AIProvider)}
                className="text-xs bg-transparent border rounded-lg pl-6 pr-3 py-1.5 appearance-none cursor-pointer"
              >
                {ALL_PROVIDERS.map((p) => {
                  const st = aiStatus[p];
                  const statusText = st === "ok" ? "✅" : st === "sem_creditos" ? "🔴" : st === "erro" ? "🔴" : st === "sem_chave" ? "🟡" : "⚪";
                  return (
                    <option key={p} value={p}>
                      {statusText} {PROVIDER_MODELS[p]} — {AI_LABELS[p].custoEstimado}
                    </option>
                  );
                })}
              </select>
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs">
                {aiStatus[provider] === "ok" ? "🟢" : aiStatus[provider] === "sem_creditos" || aiStatus[provider] === "erro" ? "🔴" : aiStatus[provider] === "sem_chave" ? "🟡" : "⚪"}
              </span>
            </div>
          </div>
        </DialogHeader>

        {alerta && (
          <div className="space-y-4">
            {/* Info do alerta */}
            <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
              <p><strong>Anúncio:</strong> {alerta.adNome}</p>
              <p><strong>Campanha:</strong> {alerta.campanhaNome}</p>
              <p><strong>Alerta:</strong> {alerta.tipo.replace(/_/g, " ")} — {alerta.valorAtual} (threshold: {alerta.threshold})</p>
              <p><strong>Contexto:</strong> R$ {alerta.spend30d.toFixed(2)} investidos / {alerta.leads30d} leads (30d) / CTR {alerta.ctr3d.toFixed(2)}% (3d) / Freq {alerta.freqMedia7d.toFixed(1)}x (7d)</p>
            </div>

            {/* Loading */}
            {estado === "loading" && (
              <div className="flex items-center justify-center py-8 gap-3">
                <Loader2 size={20} className="animate-spin text-purple-400" />
                <span className="text-sm text-muted-foreground">Analisando com {PROVIDER_MODELS[provider]}...</span>
              </div>
            )}

            {/* Erro */}
            {estado === "idle" && erro && (
              <div className="space-y-2">
                <div className="rounded-lg p-3 bg-red-500/10 border border-red-500/20 text-sm text-red-400">{erro}</div>
                <Button onClick={analisar} className="w-full" variant="outline">
                  <Brain size={14} className="mr-2" />Tentar novamente
                </Button>
              </div>
            )}

            {/* Idle sem erro (não deveria acontecer com auto-analisar, mas fallback) */}
            {estado === "idle" && !erro && (
              <Button onClick={analisar} className="w-full">
                <Brain size={14} className="mr-2" />Analisar com {PROVIDER_MODELS[provider]}
              </Button>
            )}

            {/* Resultado */}
            {estado === "resultado" && (
              <div className="space-y-3">
                <div className="space-y-3">
                  {parsed.map((el, i) => {
                    if (el.type === "h2") return <h3 key={i} className="text-sm font-bold text-foreground border-b border-muted pb-1 mt-3 first:mt-0">{el.content}</h3>;
                    if (el.type === "li") return <p key={i} className="text-sm text-muted-foreground pl-4 before:content-['•'] before:mr-2 before:text-primary">{el.content}</p>;
                    if (el.content.includes("CRÍTICO") || el.content.includes("ATENÇÃO") || el.content.includes("TOLERÁVEL")) {
                      const u = extractUrgencia(el.content);
                      return (
                        <div key={i} className="flex items-start gap-2">
                          {u && <Badge className={`text-xs shrink-0 mt-0.5 ${u.color}`}>{u.label}</Badge>}
                          <p className="text-sm text-muted-foreground">{el.content.replace(/\[(CRÍTICO|ATENÇÃO|TOLERÁVEL)\]/, "").trim()}</p>
                        </div>
                      );
                    }
                    return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{el.content}</p>;
                  })}
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={copiar}>
                    <Copy size={12} className="mr-1" />Copiar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setEstado("idle"); setDiagnostico(""); setTimeout(analisar, 100); }}>
                    <RefreshCw size={12} className="mr-1" />Reanalisar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
