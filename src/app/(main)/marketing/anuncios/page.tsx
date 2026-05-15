"use client";

import { useEffect, useState, useMemo, useCallback, lazy } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdsMetadata, AdsPerformance } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  ArrowUpDown, Image as ImageIcon, ExternalLink, TrendingUp, TrendingDown,
  Eye, MousePointerClick, DollarSign, Users, Brain, Loader2, Copy, Sparkles,
  CheckCircle2, AlertTriangle, Search, ChevronDown, Radio, Video, PenLine,
} from "lucide-react";
import { usePeriodoTrafego } from "@/contexts/periodo-trafego-context";
import { truncateAdName } from "@/lib/marketing-ui";
import { cn } from "@/lib/utils";
import { useTrafegoData } from "@/hooks/use-trafego-data";
import { toast } from "sonner";

// Lazy tabs: Biblioteca + Frequencia (movidas de /criativos)
// Lazy tabs: Biblioteca + Frequencia (movidas de /criativos)
const LazyBiblioteca = lazy(() => import("@/app/marketing/biblioteca/_biblioteca-content"));
const LazyFrequencia = lazy(() => import("@/app/marketing/frequencia/_frequencia-content"));

// ─── Types for Copy Intelligence ──────────────────────────

interface AdWithPerf {
  ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  ad_body: string | null;
  ad_title: string | null;
  status: string;
  spend: number;
  leads: number;
  cpl: number;
  ctr: number;
  impressoes: number;
  cliques: number;
  composite_score: number | null;
}

interface VariacaoAB {
  versao: string;
  titulo: string;
  copy_completo: string;
  hipotese: string;
  gatilho_principal: string;
}

interface DiagnosticoCopy {
  nota_copy: number;
  pontos_fortes: string[];
  pontos_fracos: string[];
  gatilhos_mentais: string[];
  tom_de_voz: string;
  cta_efetividade: string;
}

interface AnaliseResult {
  ad_id: string;
  ad_name: string;
  diagnostico: DiagnosticoCopy;
  variacoes_ab: VariacaoAB[];
  recomendacao_geral: string;
}

// ─── Inline Copy Analysis Sheet (Task 3) ──────────────────

function CopyAnalysisSheet({
  adId,
  adName,
  existingBody,
  open,
  onOpenChange,
}: {
  adId: string;
  adName: string;
  existingBody: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copyText, setCopyText] = useState(existingBody || "");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AnaliseResult | null>(null);

  useEffect(() => { if (open) { setCopyText(existingBody || ""); setResult(null); } }, [open, existingBody]);

  async function handleAnalyze() {
    if (!copyText.trim()) { toast.error("Cole o texto da copy primeiro"); return; }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/marketing/copy-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_ids: [adId], custom_copy: copyText }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setResult(data.analises?.[0] || null);
      toast.success("Analise concluida!");
    } catch { toast.error("Erro ao analisar"); }
    setAnalyzing(false);
  }

  async function handleSave() {
    if (!copyText.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("ads_metadata").update({ ad_body: copyText }).eq("ad_id", adId);
      if (error) { toast.error("Erro ao salvar: " + error.message); }
      else { toast.success("Copy salvo!"); }
    } catch { toast.error("Erro ao salvar"); }
    setSaving(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[550px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><PenLine size={16} /> Analisar Copy</SheetTitle>
          <SheetDescription>{adName}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4 px-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cole o texto da copy deste anuncio</label>
            <textarea
              value={copyText}
              onChange={(e) => setCopyText(e.target.value)}
              rows={6}
              className="w-full mt-1 text-sm bg-transparent border rounded-lg p-3 resize-none"
              placeholder="Cole aqui o texto da copy..."
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAnalyze} disabled={analyzing || !copyText.trim()} className="gap-1.5 flex-1">
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
              Analisar com IA
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={saving || !copyText.trim()} className="gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
              Salvar copy
            </Button>
          </div>

          {result && <InlineAnaliseCard analise={result} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Top Criativos Pattern AI (Task 6) ────────────────────

function TopCreativosAnalysis({ sorted, globalCpl }: { sorted: { ad_id: string; ad_name: string | null; score: number; spend: number; cpl: number; ctr: number; totalLeads: number; creative?: { body?: string } }[]; globalCpl: number }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ commonPattern: string; nextAngle: string; pauseSuggestion: string } | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    try {
      // Top 3 by score (with spend > 0)
      const top3 = sorted.filter((a) => a.spend > 0).sort((a, b) => b.score - a.score).slice(0, 3);
      // Worst CPL with relevant spend (>= 20% of avg)
      const avgSpend = sorted.reduce((s, a) => s + a.spend, 0) / Math.max(1, sorted.length);
      const worstCpl = sorted.filter((a) => a.spend >= avgSpend * 0.2 && a.cpl > 0).sort((a, b) => b.cpl - a.cpl)[0];

      const prompt = `Analise estes top criativos de Meta Ads e retorne APENAS JSON valido:

TOP 3 CRIATIVOS:
${top3.map((a, i) => `${i + 1}. "${a.ad_name || a.ad_id}" — Score: ${a.score}, CPL: R$${a.cpl.toFixed(2)}, CTR: ${a.ctr.toFixed(2)}%, Leads: ${a.totalLeads}, Copy: "${a.creative?.body || "(sem copy)"}"` ).join("\n")}

PIOR CPL (candidato a pausar):
${worstCpl ? `"${worstCpl.ad_name || worstCpl.ad_id}" — CPL: R$${worstCpl.cpl.toFixed(2)}, Spend: R$${worstCpl.spend.toFixed(2)}, Leads: ${worstCpl.totalLeads}` : "Nenhum com spend relevante"}

Retorne: { "commonPattern": "string - o que os top criativos tem em comum", "nextAngle": "string - sugestao de angulo para proximo criativo", "pauseSuggestion": "string - qual anuncio pausar e por que" }`;

      const res = await fetch("/api/marketing/copy-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_ids: top3.map((a) => a.ad_id), custom_prompt: prompt }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); setLoading(false); return; }

      // Try parsing the AI text as JSON
      try {
        const rawText = data.analises?.[0]?.recomendacao_geral || data.raw || JSON.stringify(data.analises);
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        setResult(parsed);
      } catch {
        // Fallback: show raw analysis
        const first = data.analises?.[0];
        if (first) {
          setResult({
            commonPattern: first.diagnostico?.pontos_fortes?.join("; ") || "Analise disponivel no resultado completo",
            nextAngle: first.recomendacao_geral || "",
            pauseSuggestion: worstCpl ? `Pausar "${worstCpl.ad_name}" — CPL R$${worstCpl.cpl.toFixed(2)} muito acima da media` : "Sem sugestao",
          });
        }
      }
      toast.success("Analise concluida!");
    } catch { toast.error("Erro na analise"); }
    setLoading(false);
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={loading} className="gap-1.5">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        Padrão dos top criativos
      </Button>

      {result && (
        <Card className="mt-4 bg-primary/5 border-primary/20">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">O que os top criativos tem em comum</p>
              <p className="text-xs mt-1">{result.commonPattern}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sugestao para proximo criativo</p>
              <p className="text-xs mt-1 text-primary">{result.nextAngle}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sugestao de pausa</p>
              <p className="text-xs mt-1 text-rose-400">{result.pauseSuggestion}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN PAGE — Hub Criativos
// ═══════════════════════════════════════

import { Suspense } from "react";
import { TabelaInteligencia } from "@/components/marketing/TabelaInteligencia";
import { DrillDownEntidade } from "@/components/marketing/DrillDownEntidade";
import type { MetricaEntidade } from "@/lib/metricas/por-entidade";

export default function CriativosHubWrapper() {
  return <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>}><CriativosHubPage /></Suspense>;
}

function CriativosHubPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab") || "anuncios";
  const [tab, setTab] = useState(initialTab);

  // Sync tab with URL
  const handleTabChange = useCallback((value: string) => {
    setTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Anúncios e Criativos</h1>
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="anuncios"><Radio size={14} className="mr-1.5" />Anuncios</TabsTrigger>
            <TabsTrigger value="inteligencia"><Brain size={14} className="mr-1.5" />Inteligencia</TabsTrigger>
            <TabsTrigger value="biblioteca"><Eye size={14} className="mr-1.5" />Biblioteca</TabsTrigger>
            <TabsTrigger value="frequencia"><TrendingUp size={14} className="mr-1.5" />Frequencia</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "anuncios" && <AnunciosTab />}
      {tab === "inteligencia" && <AnunciosInteligenciaTab />}
      {tab === "biblioteca" && <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>}><LazyBiblioteca /></Suspense>}
      {tab === "frequencia" && <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>}><LazyFrequencia /></Suspense>}
    </div>
  );
}

// ═══════════════════════════════════════
// TAB: INTELIGENCIA (metricas estrategicas)
// ═══════════════════════════════════════

function AnunciosInteligenciaTab() {
  const [selectedItem, setSelectedItem] = useState<MetricaEntidade | null>(null);
  const [drillOpen, setDrillOpen] = useState(false);

  return (
    <div className="space-y-4">
      <TabelaInteligencia
        nivel="ad"
        onRowClick={(item) => { setSelectedItem(item); setDrillOpen(true); }}
      />
      <DrillDownEntidade
        item={selectedItem}
        nivel="ad"
        open={drillOpen}
        onOpenChange={setDrillOpen}
      />
    </div>
  );
}

// ═══════════════════════════════════════
// TAB: ANÚNCIOS (original content + copy button + top pattern)
// ═══════════════════════════════════════

function AnunciosTab() {
  const filters = usePeriodoTrafego();
  const { data: tData, isLoading: loading } = useTrafegoData(filters.dataInicio, filters.dataFim, filters.statusFiltro);

  const metadata = tData?.metadata || [];
  const performance = tData?.performance || [];
  const attrLeads = tData?.attrLeads || [];

  const [sortCol, setSortCol] = useState("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Copy analysis sheet state
  const [copySheetOpen, setCopySheetOpen] = useState(false);
  const [copySheetAd, setCopySheetAd] = useState<{ adId: string; adName: string; body: string | null } | null>(null);

  const [creatives, setCreatives] = useState<Record<string, { thumbnail_url?: string; image_url?: string; body?: string; title?: string; link_url?: string; call_to_action_type?: string }>>({});

  useEffect(() => {
    async function loadCreatives() {
      const creativesMap: typeof creatives = {};
      try {
        const apiRes = await fetch("/api/meta-creatives");
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          for (const c of (apiData.data || [])) {
            creativesMap[c.id] = {
              thumbnail_url: c.thumbnail_url,
              image_url: c.image_url,
              body: c.body,
              title: c.title,
              link_url: c.link_url,
              call_to_action_type: c.call_to_action_type,
            };
          }
        }
      } catch { /* ignore */ }
      setCreatives(creativesMap);
    }
    loadCreatives();
  }, []);

  const campanhasLista = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of metadata) {
      if (a.campaign_id && !map.has(a.campaign_id)) map.set(a.campaign_id, a.campaign_name || a.campaign_id);
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [metadata]);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando anuncios...</p></div>;

  const filteredMetadata = filters.campanhaFiltro !== "all"
    ? metadata.filter((m) => m.campaign_id === filters.campanhaFiltro)
    : metadata;

  const adIds = new Set(filteredMetadata.map((m) => m.ad_id));
  const filteredPerf = performance.filter((p) => adIds.has(p.ad_id));

  const globalSpend = filteredPerf.reduce((s, p) => s + Number(p.spend), 0);
  const globalMetaLeads = filteredPerf.reduce((s, p) => s + p.leads, 0);
  const globalCpl = globalMetaLeads > 0 ? globalSpend / globalMetaLeads : 0;
  const globalImpressions = filteredPerf.reduce((s, p) => s + p.impressoes, 0);
  const globalClicks = filteredPerf.reduce((s, p) => s + p.cliques, 0);
  const globalCtr = globalImpressions > 0 ? (globalClicks / globalImpressions) * 100 : 0;

  // Leads atribuídos da view canônica (vw_atribuicao_lead_mes)
  const globalAttrLeads = attrLeads.length;
  const globalAttrCpl = globalAttrLeads > 0 ? globalSpend / globalAttrLeads : 0;

  const adRows = filteredMetadata.map((ad) => {
    const perfs = filteredPerf.filter((p) => p.ad_id === ad.ad_id);
    const lds = attrLeads.filter((l) => l.ad_id === ad.ad_id);
    const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
    const impressoes = perfs.reduce((s, p) => s + p.impressoes, 0);
    const cliques = perfs.reduce((s, p) => s + p.cliques, 0);
    const metaLeads = perfs.reduce((s, p) => s + p.leads, 0);
    const totalLeads = lds.length;
    const qualificados = lds.filter((l) => l.foi_qualificado).length;
    const reunioes = lds.filter((l) => l.teve_reuniao_agendada).length;
    const reunioesRealizadas = lds.filter((l) => l.teve_reuniao_realizada).length;
    const fechados = lds.filter((l) => l.virou_cliente).length;
    const taxaQualif = totalLeads > 0 ? (qualificados / totalLeads) * 100 : 0;
    const taxaFechamento = totalLeads > 0 ? (fechados / totalLeads) * 100 : 0;
    const cpl = totalLeads > 0 ? spend / totalLeads : 0;
    const cprf = reunioesRealizadas > 0 ? spend / reunioesRealizadas : 0;
    const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;

    const cplRatio = globalAttrCpl > 0 && cpl > 0 ? Math.max(0, Math.min(100, (1 - (cpl - globalAttrCpl) / globalAttrCpl) * 50 + 50)) : 50;
    const ctrRatio = globalCtr > 0 ? Math.max(0, Math.min(100, (ctr / globalCtr) * 50)) : 50;
    const volumeRatio = globalAttrLeads > 0 ? Math.min(100, (totalLeads / globalAttrLeads) * 500) : 0;
    const qualRatio = totalLeads > 0 ? Math.min(100, taxaQualif) : 50;
    const score = Math.round(cplRatio * 0.35 + ctrRatio * 0.25 + volumeRatio * 0.20 + qualRatio * 0.20);

    const creative = creatives[ad.ad_id];

    return { ...ad, spend, impressoes, cliques, totalLeads, metaLeads, qualificados, reunioes, reunioesRealizadas, fechados, taxaQualif, taxaFechamento, cpl, cprf, ctr, score, creative };
  }).filter((ad) => !filters.somenteComDados || ad.spend > 0 || ad.impressoes > 0);

  const toggleSort = (col: string) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("desc"); } };
  const sorted = [...adRows].sort((a, b) => { const va = (a as unknown as Record<string, number>)[sortCol] ?? 0; const vb = (b as unknown as Record<string, number>)[sortCol] ?? 0; return sortDir === "asc" ? va - vb : vb - va; });

  const scoreColor = (s: number) => s >= 70 ? "text-emerald-500 dark:text-emerald-400" : s >= 40 ? "text-amber-500 dark:text-amber-400" : "text-red-500 dark:text-red-400";
  const scoreBg = (s: number) => s >= 70 ? "bg-emerald-500/10" : s >= 40 ? "bg-amber-500/10" : "bg-red-500/10";

  // Determine if ad can have copy analyzed (video or image with text)
  const canAnalyzeCopy = (ad: typeof adRows[0]) => {
    const c = ad.creative;
    return !!(c?.body || c?.title || c?.image_url || c?.thumbnail_url);
  };

  function openCopySheet(ad: typeof adRows[0]) {
    setCopySheetAd({ adId: ad.ad_id, adName: ad.ad_name || ad.ad_id, body: ad.creative?.body || null });
    setCopySheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-lg font-normal text-muted-foreground">({metadata.length} anuncios)</span>
            <TopCreativosAnalysis sorted={sorted} globalCpl={globalCpl} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("cards")}
              className={cn("px-3 py-1.5 text-xs rounded-lg transition-all", viewMode === "cards" ? "gradient-primary text-white" : "border border-border dark:border-white/[0.08] text-muted-foreground hover:text-foreground")}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn("px-3 py-1.5 text-xs rounded-lg transition-all", viewMode === "table" ? "gradient-primary text-white" : "border border-border dark:border-white/[0.08] text-muted-foreground hover:text-foreground")}
            >
              Tabela
            </button>
          </div>
        </div>
        {/* Period selector is now in the layout */}
      </div>

      {/* Cards View */}
      {viewMode === "cards" && (
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((ad) => {
            const c = ad.creative;
            const thumb = c?.image_url || c?.thumbnail_url;
            return (
              <Card key={ad.ad_id} className="overflow-hidden group/card">
                <div className="h-[2px] w-full gradient-primary opacity-30 group-hover/card:opacity-70 transition-opacity duration-300" />
                <CardContent className="p-0">
                  <div className="flex gap-0">
                    <div className="w-[120px] min-h-[140px] shrink-0 bg-muted/30 dark:bg-white/[0.03] flex items-center justify-center overflow-hidden border-r border-border dark:border-white/[0.06]">
                      {thumb ? (
                        <img src={thumb} alt={ad.ad_name || ""} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="flex items-center justify-center w-full h-full"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted-foreground/30"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>'; }} />
                      ) : (
                        <ImageIcon size={24} className="text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 p-4 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" title={ad.ad_name || ad.ad_id}>{truncateAdName(ad.ad_name || ad.ad_id)}</p>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={ad.campaign_name || ""}>{ad.campaign_name || ""}</p>
                        </div>
                        <Badge className={cn("text-[10px] shrink-0 font-bold", scoreBg(ad.score), scoreColor(ad.score))}>{ad.score}</Badge>
                      </div>

                      {c?.body && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2.5 leading-relaxed" title={c.body}>{c.body}</p>
                      )}

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <DollarSign size={10} className="text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">Invest.</span>
                          <span className="text-[11px] font-semibold ml-auto">{formatCurrency(ad.spend)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users size={10} className="text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">Leads</span>
                          <span className="text-[11px] font-bold ml-auto">{ad.totalLeads}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <TrendingDown size={10} className="text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">CPL</span>
                          <span className={cn("text-[11px] font-medium ml-auto", ad.cpl > 0 && ad.cpl < globalCpl ? "text-emerald-500 dark:text-emerald-400" : ad.cpl > globalCpl * 1.3 ? "text-red-500 dark:text-red-400" : "")}>
                            {ad.totalLeads > 0 ? formatCurrency(ad.cpl) : "\u2014"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MousePointerClick size={10} className="text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">CTR</span>
                          <span className={cn("text-[11px] font-medium ml-auto", ad.ctr >= 1.5 ? "text-emerald-500 dark:text-emerald-400" : ad.ctr > 0 && ad.ctr < 0.8 ? "text-red-500 dark:text-red-400" : "")}>
                            {formatPercent(ad.ctr)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Eye size={10} className="text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">Impr.</span>
                          <span className="text-[11px] ml-auto">{ad.impressoes.toLocaleString("pt-BR")}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <TrendingUp size={10} className="text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">Qualif.</span>
                          <span className={cn("text-[11px] font-medium ml-auto", ad.taxaQualif >= 40 ? "text-emerald-500 dark:text-emerald-400" : ad.taxaQualif >= 20 ? "text-amber-500 dark:text-amber-400" : ad.totalLeads > 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground")}>
                            {ad.totalLeads > 0 ? formatPercent(ad.taxaQualif) : "\u2014"}
                          </span>
                        </div>
                      </div>
                      {/* Funnel metrics */}
                      <div className="grid grid-cols-3 gap-x-3 gap-y-1 mt-1 pt-1 border-t border-border/30 dark:border-white/[0.04]">
                        <div className="text-center">
                          <p className="text-[9px] text-muted-foreground">Reun. Feitas</p>
                          <p className="text-[11px] font-semibold">{ad.reunioesRealizadas || "\u2014"}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] text-muted-foreground">CPRF</p>
                          <p className="text-[11px] font-semibold">{ad.cprf > 0 ? formatCurrency(ad.cprf) : "\u2014"}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] text-muted-foreground">Fechados</p>
                          <p className={cn("text-[11px] font-semibold", ad.fechados > 0 ? "text-emerald-500 dark:text-emerald-400" : "")}>{ad.fechados || "\u2014"}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border dark:border-white/[0.06]">
                        <Badge className={cn("text-[9px]", ad.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                          {ad.status === "ACTIVE" ? "Ativo" : (ad.status || "").replace(/_/g, " ")}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {canAnalyzeCopy(ad) && (
                            <button onClick={() => openCopySheet(ad)} className="text-[9px] text-primary hover:text-primary/80 font-medium flex items-center gap-0.5">
                              <PenLine size={10} /> Analisar copy
                            </button>
                          )}
                          {c?.link_url && (
                            <a href={c.link_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors" title="Abrir link">
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border dark:border-white/[0.06] text-muted-foreground">
                  {[
                    { key: "ad_name", label: "Anúncio" },
                    { key: "score", label: "Score" },
                    { key: "spend", label: "Investido" },
                    { key: "totalLeads", label: "Leads" },
                    { key: "cpl", label: "CPL" },
                    { key: "ctr", label: "CTR" },
                    { key: "qualificados", label: "Qualif." },
                    { key: "taxaQualif", label: "% Qualif" },
                    { key: "reunioes", label: "Reun. Ag." },
                    { key: "reunioesRealizadas", label: "Reun. Feitas" },
                    { key: "cprf", label: "CPRF" },
                    { key: "fechados", label: "Fechamentos" },
                    { key: "taxaFechamento", label: "Tx. Fech." },
                  ].map((col) => (
                    <th key={col.key} onClick={() => toggleSort(col.key)} className="px-3 py-2.5 font-medium text-left cursor-pointer hover:text-foreground whitespace-nowrap text-xs">{col.label} {sortCol === col.key && <ArrowUpDown size={10} className="inline" />}</th>
                  ))}
                  <th className="px-3 py-2.5 font-medium text-xs">Status</th>
                  <th className="px-3 py-2.5 font-medium text-xs">Acao</th>
                </tr></thead>
                <tbody>
                  {sorted.map((ad) => (
                    <tr key={ad.ad_id} className="border-b border-border dark:border-white/[0.06] hover:bg-muted/30 dark:hover:bg-white/[0.02]">
                      <td className="px-3 py-2 max-w-[220px]">
                        <div className="flex items-center gap-2.5">
                          {ad.creative?.thumbnail_url || ad.creative?.image_url ? (
                            <img src={ad.creative.image_url || ad.creative.thumbnail_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <div className="w-8 h-8 rounded bg-muted/50 dark:bg-white/[0.04] flex items-center justify-center shrink-0"><ImageIcon size={12} className="text-muted-foreground/30" /></div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium" title={ad.ad_name || ad.ad_id}>{truncateAdName(ad.ad_name || ad.ad_id)}</div>
                            <div className="text-[10px] text-muted-foreground truncate" title={ad.campaign_name || undefined}>{ad.campaign_name || ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2"><Badge className={cn("text-[10px]", scoreBg(ad.score), scoreColor(ad.score))}>{ad.score}</Badge></td>
                      <td className="px-3 py-2 text-xs font-medium">{formatCurrency(ad.spend)}</td>
                      <td className="px-3 py-2 text-xs font-bold">{ad.totalLeads}{ad.metaLeads > 0 && ad.metaLeads !== ad.totalLeads ? <span className="text-[10px] text-muted-foreground ml-1">({ad.metaLeads} Meta)</span> : null}</td>
                      <td className="px-3 py-2 text-xs">{ad.totalLeads > 0 ? formatCurrency(ad.cpl) : "\u2014"}</td>
                      <td className={cn("px-3 py-2 text-xs font-medium", ad.ctr >= 1.5 ? "text-emerald-500 dark:text-emerald-400" : ad.ctr >= 0.8 ? "" : ad.ctr > 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground")}>{formatPercent(ad.ctr)}</td>
                      <td className="px-3 py-2 text-xs">{ad.qualificados > 0 ? ad.qualificados : "\u2014"}</td>
                      <td className={cn("px-3 py-2 text-xs font-medium", ad.taxaQualif >= 40 ? "text-emerald-500 dark:text-emerald-400" : ad.taxaQualif >= 20 ? "text-amber-500 dark:text-amber-400" : ad.totalLeads > 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground")}>{ad.totalLeads > 0 ? formatPercent(ad.taxaQualif) : "\u2014"}</td>
                      <td className="px-3 py-2 text-xs">{ad.reunioes > 0 ? ad.reunioes : "\u2014"}</td>
                      <td className="px-3 py-2 text-xs">{ad.reunioesRealizadas > 0 ? ad.reunioesRealizadas : "\u2014"}</td>
                      <td className="px-3 py-2 text-xs">{ad.cprf > 0 ? formatCurrency(ad.cprf) : "\u2014"}</td>
                      <td className="px-3 py-2 text-xs">{ad.fechados > 0 ? ad.fechados : "\u2014"}</td>
                      <td className={cn("px-3 py-2 text-xs font-medium", ad.taxaFechamento >= 10 ? "text-emerald-500 dark:text-emerald-400" : ad.taxaFechamento >= 5 ? "text-amber-500 dark:text-amber-400" : ad.fechados > 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground")}>{ad.fechados > 0 ? formatPercent(ad.taxaFechamento) : "\u2014"}</td>
                      <td className="px-3 py-2"><Badge className={cn("text-[10px]", ad.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>{ad.status === "ACTIVE" ? "Ativo" : (ad.status || "").replace(/_/g, " ")}</Badge></td>
                      <td className="px-3 py-2">
                        {canAnalyzeCopy(ad) && (
                          <button onClick={() => openCopySheet(ad)} className="text-[10px] text-primary hover:text-primary/80 font-medium flex items-center gap-0.5">
                            <PenLine size={10} /> Copy
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {sorted.length === 0 && <tr><td colSpan={16} className="text-center text-muted-foreground py-8">Nenhum anuncio encontrado</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {sorted.length === 0 && viewMode === "cards" && (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Nenhum anuncio encontrado para o periodo selecionado.</p>
        </div>
      )}

      {/* Copy Analysis Sheet */}
      {copySheetAd && (
        <CopyAnalysisSheet
          adId={copySheetAd.adId}
          adName={copySheetAd.adName}
          existingBody={copySheetAd.body}
          open={copySheetOpen}
          onOpenChange={setCopySheetOpen}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// TAB: VÍDEO (content from trafego/video)
// ═══════════════════════════════════════

function VideoTab() {
  return (
    <DateFilterProvider>
      <div className="space-y-6">
        <div className="flex justify-end">
          <VideoDateFilter />
        </div>
        <VideoKpiCards />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <HookRanking />
          </div>
          <div className="lg:col-span-3">
            <FunnelRetentionMap />
          </div>
        </div>
        <CreativeLibrary />
        <CreativeFatigue />
      </div>
    </DateFilterProvider>
  );
}

// ═══════════════════════════════════════
// TAB: COPY (content from copy-intelligence)
// ═══════════════════════════════════════

function CopyCheckbox({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "h-4 w-4 shrink-0 rounded border transition-colors flex items-center justify-center",
        checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-foreground"
      )}
    >
      {checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
  );
}

function CopyTab() {
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
    const [{ data: meta }, { data: perf }, { data: sc }] = await Promise.all([
      supabase.from("ads_metadata").select("*"),
      supabase.from("ads_performance").select("ad_id, spend, leads, cpl, ctr, impressoes, cliques").limit(10000),
      supabase.from("creative_scores").select("ad_id, composite_score"),
    ]);
    setMetadata((meta || []) as AdsMetadata[]);
    setPerformance((perf || []) as AdsPerformance[]);
    setScores((sc || []) as { ad_id: string; composite_score: number }[]);
    setLoading(false);
  }

  const perfMap = useMemo(() => {
    const map: Record<string, { spend: number; leads: number; impressoes: number; cliques: number }> = {};
    for (const row of performance) {
      if (!map[row.ad_id]) map[row.ad_id] = { spend: 0, leads: 0, impressoes: 0, cliques: 0 };
      map[row.ad_id].spend += Number(row.spend || 0);
      map[row.ad_id].leads += Number(row.leads || 0);
      map[row.ad_id].impressoes += Number(row.impressoes || 0);
      map[row.ad_id].cliques += Number(row.cliques || 0);
    }
    return map;
  }, [performance]);

  const scoreMap = useMemo(() => new Map(scores.map((s) => [s.ad_id, s.composite_score])), [scores]);

  const ads: AdWithPerf[] = useMemo(() => {
    return metadata.map((m) => {
      const perf = perfMap[m.ad_id] || { spend: 0, leads: 0, impressoes: 0, cliques: 0 };
      const cpl = perf.leads > 0 ? perf.spend / perf.leads : 0;
      const ctr = perf.impressoes > 0 ? (perf.cliques / perf.impressoes) * 100 : 0;
      return {
        ad_id: m.ad_id, ad_name: m.ad_name, campaign_name: m.campaign_name, adset_name: m.adset_name,
        ad_body: m.ad_body || null, ad_title: m.ad_title || null, status: m.status,
        spend: perf.spend, leads: perf.leads, cpl, ctr, impressoes: perf.impressoes, cliques: perf.cliques,
        composite_score: scoreMap.get(m.ad_id) ?? null,
      };
    });
  }, [metadata, perfMap, scoreMap]);

  const campanhas = useMemo(() => {
    const set = new Map<string, string>();
    for (const ad of ads) { if (ad.campaign_name && !set.has(ad.campaign_name)) set.set(ad.campaign_name, ad.campaign_name); }
    return Array.from(set.values()).sort();
  }, [ads]);

  const filtered = useMemo(() => {
    return ads.filter((ad) => {
      if (filtroStatus !== "all" && ad.status !== filtroStatus) return false;
      if (filtroCampanha !== "all" && ad.campaign_name !== filtroCampanha) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const match = (ad.ad_name || "").toLowerCase().includes(term) || (ad.campaign_name || "").toLowerCase().includes(term) || (ad.ad_body || "").toLowerCase().includes(term) || (ad.ad_title || "").toLowerCase().includes(term);
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => b.spend - a.spend);
  }, [ads, filtroStatus, filtroCampanha, searchTerm]);

  function toggleSelect(adId: string) { setSelected((prev) => { const next = new Set(prev); if (next.has(adId)) next.delete(adId); else next.add(adId); return next; }); }
  function toggleSelectAll() { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((a) => a.ad_id))); }

  async function analisarUnico(adId: string) {
    setAnalyzingSingle(adId);
    try {
      const res = await fetch("/api/marketing/copy-intelligence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ad_ids: [adId] }) });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setAnalises(data.analises || []); setSheetOpen(true); toast.success("Analise concluida!");
    } catch { toast.error("Erro ao analisar"); }
    setAnalyzingSingle(null);
  }

  async function analisarSelecionados() {
    if (selected.size === 0) { toast.error("Selecione pelo menos 1 criativo"); return; }
    setAnalyzing(true);
    try {
      const ids = Array.from(selected).slice(0, 10);
      const res = await fetch("/api/marketing/copy-intelligence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ad_ids: ids }) });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setAnalises(data.analises || []); setSheetOpen(true); toast.success(`${(data.analises || []).length} criativos analisados!`);
    } catch { toast.error("Erro ao analisar"); }
    setAnalyzing(false);
  }

  const totalAds = filtered.length;
  const comCopy = filtered.filter((a) => a.ad_body).length;
  const semCopy = totalAds - comCopy;
  const avgScore = (() => {
    const withScore = filtered.filter((a) => a.composite_score !== null);
    if (withScore.length === 0) return null;
    return withScore.reduce((s, a) => s + (a.composite_score || 0), 0) / withScore.length;
  })();

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Analise de copy com IA e geracao de variacoes A/B</p>
        </div>
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
          <option value="ACTIVE">Ativos</option>
          <option value="all">Todos</option>
          <option value="PAUSED">Pausados</option>
        </select>
      </div>

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Nenhum criativo encontrado.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 px-2 w-8"><CopyCheckbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleSelectAll} /></th>
                  <th className="py-2 px-2 text-left">Criativo</th>
                  <th className="py-2 px-2 text-left max-w-[200px]">Copy</th>
                  <th className="py-2 px-2 text-right">Spend</th>
                  <th className="py-2 px-2 text-right">Leads</th>
                  <th className="py-2 px-2 text-right">CPL</th>
                  <th className="py-2 px-2 text-right">CTR</th>
                  <th className="py-2 px-2 text-center">Score</th>
                  <th className="py-2 px-2 text-center">Acao</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ad) => (
                  <tr key={ad.ad_id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 px-2"><CopyCheckbox checked={selected.has(ad.ad_id)} onCheckedChange={() => toggleSelect(ad.ad_id)} /></td>
                    <td className="py-2 px-2 max-w-[180px]">
                      <p className="text-xs font-medium truncate">{ad.ad_name || ad.ad_id}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{ad.campaign_name}</p>
                    </td>
                    <td className="py-2 px-2 max-w-[200px]">
                      {ad.ad_body ? (
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{ad.ad_body}</p>
                      ) : (
                        <Badge className="text-[9px] bg-yellow-500/15 text-yellow-400">sem copy</Badge>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs">{formatCurrency(ad.spend)}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs">{ad.leads || "\u2014"}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs">{ad.cpl > 0 ? formatCurrency(ad.cpl) : "\u2014"}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs">{ad.ctr > 0 ? formatPercent(ad.ctr) : "\u2014"}</td>
                    <td className="py-2 px-2 text-center">
                      {ad.composite_score !== null ? <CopyScoreBadge score={ad.composite_score} /> : <span className="text-[10px] text-muted-foreground">\u2014</span>}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" disabled={analyzingSingle === ad.ad_id} onClick={() => analisarUnico(ad.ad_id)}>
                        {analyzingSingle === ad.ad_id ? <Loader2 size={10} className="animate-spin" /> : <Brain size={10} />}
                        Analisar
                      </Button>
                    </td>
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
          <div className="mt-6 space-y-8">
            {analises.map((analise, idx) => <InlineAnaliseCard key={analise.ad_id || idx} analise={analise} />)}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Shared sub-components ──────────────────────────

function CopyScoreBadge({ score }: { score: number }) {
  const n = Math.round(score);
  const cls =
    n <= 30 ? "bg-red-500/15 text-red-400 border-red-500/30" :
    n <= 60 ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" :
    n <= 80 ? "bg-blue-500/15 text-blue-400 border-blue-500/30" :
              "bg-green-500/15 text-green-400 border-green-500/30";
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold ${cls}`}>{n}</span>;
}

function NotaCopyBadge({ nota }: { nota?: number }) {
  if (nota === undefined || nota === null) return null;
  const cls =
    nota <= 3 ? "bg-red-500/15 text-red-400 border-red-500/30" :
    nota <= 5 ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" :
    nota <= 7 ? "bg-blue-500/15 text-blue-400 border-blue-500/30" :
               "bg-green-500/15 text-green-400 border-green-500/30";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-semibold ${cls}`}>
      <span className="text-sm font-bold">{nota}</span>/10
    </span>
  );
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
              {(d.pontos_fortes || []).map((p, i) => (
                <p key={i} className="text-[11px] text-green-400 flex items-start gap-1"><CheckCircle2 size={10} className="mt-0.5 shrink-0" /> {p}</p>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Pontos fracos</p>
              {(d.pontos_fracos || []).map((p, i) => (
                <p key={i} className="text-[11px] text-red-400 flex items-start gap-1"><AlertTriangle size={10} className="mt-0.5 shrink-0" /> {p}</p>
              ))}
            </div>
          </div>
          {(d.gatilhos_mentais || []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {d.gatilhos_mentais.map((g, i) => <Badge key={i} className="text-[9px] bg-purple-500/15 text-purple-400">{g}</Badge>)}
            </div>
          )}
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
                  <div className="flex items-center gap-2">
                    <Badge className="text-[9px] bg-primary/15 text-primary">Versao {v.versao}</Badge>
                    <span className="text-xs font-medium">{v.titulo}</span>
                  </div>
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
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => { navigator.clipboard.writeText(v.copy_completo); toast.success("Copy copiado!"); }}>
                        <Copy size={10} /> Copiar
                      </Button>
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

