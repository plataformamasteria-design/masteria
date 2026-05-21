"use client";

import { useEffect, useState, useMemo } from "react";
import type { AdsMetadata, AdsPerformance } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  Brain, Loader2, Search, Sparkles, CheckCircle2, AlertTriangle,
  ChevronDown, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AdWithPerf {
  ad_id: string; ad_name: string | null; campaign_name: string | null; adset_name: string | null;
  ad_body: string | null; ad_title: string | null; status: string;
  spend: number; leads: number; cpl: number; ctr: number; impressoes: number; cliques: number;
  composite_score: number | null;
  thumbnail_url?: string | null;
}

interface VariacaoAB { versao: string; titulo: string; copy_completo: string; hipotese: string; gatilho_principal: string; }
interface DiagnosticoCopy { nota_copy: number; pontos_fortes: string[]; pontos_fracos: string[]; gatilhos_mentais: string[]; tom_de_voz: string; cta_efetividade: string; }
interface AnaliseResult { ad_id: string; ad_name: string; diagnostico: DiagnosticoCopy; variacoes_ab: VariacaoAB[]; recomendacao_geral: string; }

function CopyCheckbox({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={() => onCheckedChange(!checked)}
      className={cn("h-4 w-4 shrink-0 rounded border transition-colors flex items-center justify-center", checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-foreground")}>
      {checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
  );
}

function CopyScoreBadge({ score }: { score: number }) {
  const n = Math.round(score);
  const cls = n <= 30 ? "bg-destructive/15 text-destructive border-destructive/30" : n <= 60 ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" : n <= 80 ? "bg-accent/15 text-accent border-accent/30" : "bg-green-500/15 text-green-400 border-green-500/30";
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold ${cls}`}>{n}</span>;
}

function NotaCopyBadge({ nota }: { nota?: number }) {
  if (nota === undefined || nota === null) return null;
  const cls = nota <= 3 ? "bg-destructive/15 text-destructive border-destructive/30" : nota <= 5 ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" : nota <= 7 ? "bg-accent/15 text-accent border-accent/30" : "bg-green-500/15 text-green-400 border-green-500/30";
  return <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-semibold ${cls}`}><span className="text-sm font-bold">{nota}</span>/10</span>;
}

function InlineAnaliseCard({ analise }: { analise: AnaliseResult }) {
  const [expandedVar, setExpandedVar] = useState<string | null>(null);
  const d = analise.diagnostico;
  return (
    <div className="space-y-4 border-b border-border/30 pb-6 last:border-0">
      <div className="flex items-start justify-between">
        <p className="text-sm font-bold">{analise.ad_name || analise.ad_id}</p>
        <NotaCopyBadge nota={d?.nota_copy} />
      </div>
      {d && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Pontos fortes</p>
              {(d.pontos_fortes || []).map((p, i) => <p key={i} className="text-[11px] text-green-400 flex items-start gap-1"><CheckCircle2 size={10} className="mt-0.5 shrink-0" /> {p}</p>)}
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Pontos fracos</p>
              {(d.pontos_fracos || []).map((p, i) => <p key={i} className="text-[11px] text-destructive flex items-start gap-1"><AlertTriangle size={10} className="mt-0.5 shrink-0" /> {p}</p>)}
            </div>
          </div>
          {(d.gatilhos_mentais || []).length > 0 && <div className="flex flex-wrap gap-1">{d.gatilhos_mentais.map((g, i) => <Badge key={i} className="text-[9px] bg-purple-500/15 text-purple-400">{g}</Badge>)}</div>}
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            {d.tom_de_voz && <span>Tom: <strong className="text-foreground">{d.tom_de_voz}</strong></span>}
            {d.cta_efetividade && <span>CTA: <strong className="text-foreground">{d.cta_efetividade}</strong></span>}
          </div>
        </div>
      )}
      {(analise.variacoes_ab || []).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium flex items-center gap-1"><Sparkles size={12} className="text-primary" /> Variacoes A/B para teste</p>
          {analise.variacoes_ab.map((v) => {
            const isOpen = expandedVar === v.versao;
            return (
              <div key={v.versao} className="border rounded-lg overflow-hidden">
                <button onClick={() => setExpandedVar(isOpen ? null : v.versao)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2"><Badge className="text-[9px] bg-primary/15 text-primary">Versao {v.versao}</Badge><span className="text-xs font-medium">{v.titulo}</span></div>
                  <ChevronDown size={12} className={cn("text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2 border-t">
                    <div className="bg-muted/30 rounded-lg p-3 mt-2"><p className="text-xs whitespace-pre-wrap">{v.copy_completo}</p></div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground">Hipotese: <span className="text-foreground">{v.hipotese}</span></p>
                        <p className="text-[10px] text-muted-foreground">Gatilho: <Badge className="text-[9px] bg-purple-500/15 text-purple-400">{v.gatilho_principal}</Badge></p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => { navigator.clipboard.writeText(v.copy_completo); toast.success("Copy copiado!"); }}><Copy size={10} /> Copiar</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {analise.recomendacao_geral && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <p className="text-[11px]"><strong className="text-primary">Recomendacao:</strong> <span className="text-muted-foreground">{analise.recomendacao_geral}</span></p>
        </div>
      )}
    </div>
  );
}

export default function CopyTab() {
  const [metadata, setMetadata] = useState<AdsMetadata[]>([]);
  const [performance, setPerformance] = useState<AdsPerformance[]>([]);
  const [scores, setScores] = useState<{ ad_id: string; composite_score: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroCampanha, setFiltroCampanha] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("ACTIVE");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingSingle, setAnalyzingSingle] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [analises, setAnalises] = useState<AnaliseResult[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/marketing/criativos-enriched");
      const data = await res.json();
      
      if (!data.error && data.data) {
        // Adapt mapping to match what _copy-tab expects
        const mappedAds: AdWithPerf[] = data.data.map((ad: any) => ({
          ad_id: ad.ad_id,
          ad_name: ad.ad_name,
          campaign_name: ad.campaign_name,
          adset_name: ad.adset_name || "Conjunto Padrão",
          ad_body: ad.ad_body,
          ad_title: ad.ad_title,
          status: ad.status,
          spend: ad.spend,
          leads: ad.leads_totais,
          cpl: ad.cpl || 0,
          ctr: ad.ctr || 0,
          impressoes: ad.impressoes || 0,
          cliques: ad.cliques || 0,
          composite_score: ad.composite_score,
          thumbnail_url: ad.thumbnail_url
        }));
        setMetadata(mappedAds as any); // We can store the mapped directly in a state, but for simplicity, we use metadata
      } else {
        toast.error("Erro ao carregar dados da API.");
      }
    } catch {
      toast.error("Erro de conexão ao carregar criativos.");
    }
    setLoading(false);
  }

  const ads: AdWithPerf[] = useMemo(() => metadata as unknown as AdWithPerf[], [metadata]);

  const campanhas = useMemo(() => { const set = new Map<string, string>(); for (const ad of ads) { if (ad.campaign_name && !set.has(ad.campaign_name)) set.set(ad.campaign_name, ad.campaign_name); } return Array.from(set.values()).sort(); }, [ads]);

  const filtered = useMemo(() => ads.filter((ad) => {
    if (filtroStatus !== "all" && ad.status !== filtroStatus) return false;
    if (filtroCampanha !== "all" && ad.campaign_name !== filtroCampanha) return false;
    if (searchTerm) { const term = searchTerm.toLowerCase(); if (!(ad.ad_name || "").toLowerCase().includes(term) && !(ad.campaign_name || "").toLowerCase().includes(term) && !(ad.ad_body || "").toLowerCase().includes(term) && !(ad.ad_title || "").toLowerCase().includes(term)) return false; }
    return true;
  }).sort((a, b) => b.spend - a.spend), [ads, filtroStatus, filtroCampanha, searchTerm]);

  function toggleSelect(adId: string) { setSelected((prev) => { const next = new Set(prev); if (next.has(adId)) next.delete(adId); else next.add(adId); return next; }); }
  function toggleSelectAll() { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((a) => a.ad_id))); }

  async function analisarUnico(adId: string) {
    setAnalyzingSingle(adId);
    try { const res = await fetch("/api/marketing/copy-intelligence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ad_ids: [adId] }) }); const data = await res.json(); if (data.error) { toast.error(data.error); return; } setAnalises(data.analises || []); setSheetOpen(true); toast.success("Analise concluida!"); } catch { toast.error("Erro ao analisar"); }
    setAnalyzingSingle(null);
  }

  async function analisarSelecionados() {
    if (selected.size === 0) { toast.error("Selecione pelo menos 1 criativo"); return; }
    setAnalyzing(true);
    try { const ids = Array.from(selected).slice(0, 10); const res = await fetch("/api/marketing/copy-intelligence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ad_ids: ids }) }); const data = await res.json(); if (data.error) { toast.error(data.error); return; } setAnalises(data.analises || []); setSheetOpen(true); toast.success(`${(data.analises || []).length} criativos analisados!`); } catch { toast.error("Erro ao analisar"); }
    setAnalyzing(false);
  }

  const totalAds = filtered.length;
  const comCopy = filtered.filter((a) => a.ad_body).length;
  const semCopy = totalAds - comCopy;
  const avgScore = (() => { const ws = filtered.filter((a) => a.composite_score !== null); return ws.length > 0 ? ws.reduce((s, a) => s + (a.composite_score || 0), 0) / ws.length : null; })();

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <p className="text-sm text-muted-foreground">Analise de copy com IA e geracao de variacoes A/B</p>
        <div className="flex items-center gap-2">
          {selected.size > 0 && <Badge className="bg-primary/15 text-primary">{selected.size} selecionado{selected.size > 1 ? "s" : ""}</Badge>}
          <Button onClick={analisarSelecionados} disabled={analyzing || selected.size === 0} className="gap-1.5">
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
            Analisar selecionados ({selected.size})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-[10px] text-muted-foreground">Total criativos</p><p className="text-2xl font-bold">{totalAds}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] text-muted-foreground">Com copy</p><p className="text-2xl font-bold text-green-400">{comCopy}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] text-muted-foreground">Sem copy</p><p className={cn("text-2xl font-bold", semCopy > 0 ? "text-yellow-400" : "")}>{semCopy}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] text-muted-foreground">Score medio</p><p className="text-2xl font-bold">{avgScore !== null ? avgScore.toFixed(0) : "\u2014"}</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar por nome, copy, campanha..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full text-xs bg-transparent border rounded-lg pl-9 pr-3 py-2" />
        </div>
        <select value={filtroCampanha} onChange={(e) => setFiltroCampanha(e.target.value)} className="text-xs bg-transparent border rounded-lg px-3 py-2 max-w-[220px]">
          <option value="all">Todas campanhas</option>
          {campanhas.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="text-xs bg-transparent border rounded-lg px-3 py-2">
          <option value="ACTIVE">Ativos</option><option value="all">Todos</option><option value="PAUSED">Pausados</option>
        </select>
      </div>

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12"><Sparkles size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" /><p className="text-sm text-muted-foreground">Nenhum criativo encontrado.</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 px-2 w-8"><CopyCheckbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleSelectAll} /></th>
                <th className="py-2 px-2 text-left">Criativo</th><th className="py-2 px-2 text-left max-w-[200px]">Copy</th>
                <th className="py-2 px-2 text-right">Spend</th><th className="py-2 px-2 text-right">Leads</th><th className="py-2 px-2 text-right">CPL</th><th className="py-2 px-2 text-right">CTR</th>
                <th className="py-2 px-2 text-center">Score</th><th className="py-2 px-2 text-center">Acao</th>
              </tr></thead>
              <tbody>
                {filtered.map((ad) => (
                  <tr key={ad.ad_id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 px-2"><CopyCheckbox checked={selected.has(ad.ad_id)} onCheckedChange={() => toggleSelect(ad.ad_id)} /></td>
                    <td className="py-2 px-2 max-w-[180px]">
                      <div className="flex items-center gap-2">
                        {ad.thumbnail_url ? (
                          <div className="relative w-8 h-8 shrink-0">
                            <div className="absolute inset-0 rounded bg-muted flex items-center justify-center z-0 text-[8px] font-medium text-muted-foreground">AD</div>
                            <img src={ad.thumbnail_url} alt="" className="absolute inset-0 w-8 h-8 rounded object-cover z-10" onError={(e) => e.currentTarget.style.display = 'none'} />
                          </div>
                        ) : (
                          <div className="w-8 h-8 shrink-0 rounded bg-muted flex items-center justify-center text-[8px] font-medium text-muted-foreground">AD</div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate" title={ad.ad_name || ad.ad_id}>{ad.ad_name || ad.ad_id}</p>
                          <p className="text-[10px] text-muted-foreground truncate" title={ad.campaign_name || ""}>{ad.campaign_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 max-w-[200px]">{ad.ad_body ? <p className="text-[11px] text-muted-foreground line-clamp-2">{ad.ad_body}</p> : (
                      <div className="group relative inline-block">
                        <Badge className="text-[9px] bg-yellow-500/15 text-yellow-400 cursor-help">sem copy</Badge>
                        <div className="invisible group-hover:visible absolute left-0 top-full mt-1 z-50 w-52 p-2 text-[10px] text-muted-foreground bg-card border rounded-lg shadow-lg leading-relaxed">
                          Adicione o texto do anuncio para analise de IA. A analise identifica: elementos de persuasao, pontos de melhoria e gera variacoes A/B automaticamente.
                        </div>
                      </div>
                    )}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs">{formatCurrency(ad.spend)}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs">{ad.leads || "\u2014"}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs">{ad.cpl > 0 ? formatCurrency(ad.cpl) : "\u2014"}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs">{ad.ctr > 0 ? formatPercent(ad.ctr) : "\u2014"}</td>
                    <td className="py-2 px-2 text-center">{ad.composite_score !== null ? <CopyScoreBadge score={ad.composite_score} /> : <span className="text-[10px] text-muted-foreground">{"\u2014"}</span>}</td>
                    <td className="py-2 px-2 text-center"><Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" disabled={analyzingSingle === ad.ad_id} onClick={() => analisarUnico(ad.ad_id)}>{analyzingSingle === ad.ad_id ? <Loader2 size={10} className="animate-spin" /> : <Brain size={10} />} Analisar</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[650px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Brain size={18} /> Copy Intelligence</SheetTitle>
            <SheetDescription>{analises.length} criativo{analises.length > 1 ? "s" : ""} analisado{analises.length > 1 ? "s" : ""} via Gemini Flash</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-8">{analises.map((a, i) => <InlineAnaliseCard key={a.ad_id || i} analise={a} />)}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

