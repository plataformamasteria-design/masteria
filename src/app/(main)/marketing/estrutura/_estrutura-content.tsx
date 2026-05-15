"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/format";
import { ArrowUpDown, ChevronRight, ChevronLeft, X, Brain, Eye, AlertTriangle, CheckCircle, Loader2, Link as LinkIcon, Activity } from "lucide-react";
import { usePeriodoTrafego } from "@/contexts/periodo-trafego-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTrafegoData } from "@/hooks/use-trafego-data";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import useSWR from "swr";
import { useConfigFunilCampanha, FunilCampanhaPopover, FunilBadge } from "@/components/trafego/FunilCampanhaConfig";

type Nivel = "campanhas" | "conjuntos" | "anuncios";
type TabAnuncio = "leads" | "criativo" | "anomalias";

interface AnuncioDetalhe {
  ad_id: string;
  ad_name: string;
  adset_id: string | null;
  campaign_id: string | null;
}

export default function TrafegoEstruturaPage() {
  const filters = usePeriodoTrafego();

  // Utilizando o hook Mestre de Trafego com Cache SWR! Pilar 1 de Performance!
  const { data: trafegoData, isLoading: loading } = useTrafegoData(filters.dataInicio, filters.dataFim, filters.statusFiltro);

  const metadata = trafegoData?.metadata || [];
  const performance = trafegoData?.performance || [];
  const { mapByCampaign: funilMap } = useConfigFunilCampanha();

  const [nivel, setNivel] = useState<Nivel>("campanhas");
  const [campanhaId, setCampanhaId] = useState<string | null>(null);
  const [adsetId, setAdsetId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Modal State
  const [anuncioSelecionado, setAnuncioSelecionado] = useState<AnuncioDetalhe | null>(null);
  const [tabAtiva, setTabAtiva] = useState<TabAnuncio>("leads");

  // Otimizacao do Modal de Anuncio com SWR inves de promise avulsa
  const { data: modalData, isLoading: loadingDetalhe, mutate: mutateModal } = useSWR(
    anuncioSelecionado ? ["anuncio-detalhe", anuncioSelecionado.ad_id] : null,
    async ([, adId]) => {
      const [{ data: leadsVinculados }, { data: criativo }, { data: anomalias }] = await Promise.all([
        supabase.from("leads_crm").select("id, nome, etapa, ghl_created_at, area_atuacao").eq("ad_id", adId).order("ghl_created_at", { ascending: false }).limit(200),
        supabase.from("trafego_criativos").select("*, trafego_criativo_metricas(fase_ciclo_vida, score_periodo, cpl, ctr)").eq("ad_id", adId).is("deleted_at", null).limit(1),
        supabase.from("trafego_anomalias").select("*").eq("ad_id", adId).order("criado_em", { ascending: false }).limit(20)
      ]);
      return { leads: leadsVinculados || [], criativo: criativo?.[0] || null, anomalias: anomalias || [] };
    },
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  const [analisandoIA, setAnalisandoIA] = useState(false);
  const [filtroLeadStatus, setFiltroLeadStatus] = useState("all");

  const toggleSort = (col: string) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("desc"); } };

  function drillCampanha(cid: string) { setCampanhaId(cid); setAdsetId(null); setNivel("conjuntos"); setSortCol("spend"); }
  function drillAdset(asid: string) { setAdsetId(asid); setNivel("anuncios"); setSortCol("spend"); }
  function voltar() {
    if (nivel === "anuncios") { setAdsetId(null); setNivel("conjuntos"); }
    else if (nivel === "conjuntos") { setCampanhaId(null); setNivel("campanhas"); }
  }

  // Pillar 1: Memoizacao pesada do parser de analitica pra evitar UI Thread block
  const { rows, globaMetrics } = useMemo(() => {
    let rawRows: { id: string; nome: string; spend: number; impressoes: number; totalLeads: number; cpl: number; ctr: number; count: number; status?: string; adset_id?: string | null; campaign_id?: string | null }[] = [];

    // Calcula metricas globais pro calculo neural de qualidade
    const globalSpend = performance.reduce((s, p) => s + Number(p.spend), 0);
    const globalLeads = performance.reduce((s, p) => s + p.leads, 0);
    const globalCpl = globalLeads > 0 ? globalSpend / globalLeads : 0;
    const globalImp = performance.reduce((s, p) => s + p.impressoes, 0);
    const globalClk = performance.reduce((s, p) => s + p.cliques, 0);
    const gCtr = globalImp > 0 ? (globalClk / globalImp) * 100 : 0;

    const calcStats = (adIds: string[]) => {
      const perfs = performance.filter((p) => adIds.includes(p.ad_id));
      const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
      const impressoes = perfs.reduce((s, p) => s + p.impressoes, 0);
      const cliques = perfs.reduce((s, p) => s + p.cliques, 0);
      const totalL = perfs.reduce((s, p) => s + p.leads, 0);
      const cpl = totalL > 0 ? spend / totalL : 0;
      const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
      return { spend, impressoes, cliques, totalLeads: totalL, cpl, ctr };
    };

    if (nivel === "campanhas") {
      const campMap = new Map<string, string[]>();
      metadata.forEach((m) => { if (m.campaign_id) { const arr = campMap.get(m.campaign_id) || []; arr.push(m.ad_id); campMap.set(m.campaign_id, arr); } });
      rawRows = Array.from(campMap, ([cid, adIds]) => {
        const stats = calcStats(adIds);
        const nome = metadata.find((m) => m.campaign_id === cid)?.campaign_name || cid;
        return { id: cid, nome, ...stats, count: adIds.length };
      }).filter((r) => r.spend > 0 || r.totalLeads > 0);
    } else if (nivel === "conjuntos") {
      const adsInCamp = metadata.filter((m) => m.campaign_id === campanhaId);
      const adsetMap = new Map<string, string[]>();
      adsInCamp.forEach((m) => { if (m.adset_id) { const arr = adsetMap.get(m.adset_id) || []; arr.push(m.ad_id); adsetMap.set(m.adset_id, arr); } });
      rawRows = Array.from(adsetMap, ([asid, adIds]) => {
        const stats = calcStats(adIds);
        const nome = metadata.find((m) => m.adset_id === asid)?.adset_name || asid;
        return { id: asid, nome, ...stats, count: adIds.length };
      }).filter((r) => r.spend > 0 || r.totalLeads > 0);
    } else {
      const adsInAdset = metadata.filter((m) => m.adset_id === adsetId);
      rawRows = adsInAdset.map((ad) => {
        const stats = calcStats([ad.ad_id]);
        const cplR = globalCpl > 0 && stats.cpl > 0 ? Math.max(0, Math.min(100, (1 - (stats.cpl - globalCpl) / globalCpl) * 50 + 50)) : 50;
        const ctrR = gCtr > 0 ? Math.max(0, Math.min(100, (stats.ctr / gCtr) * 50)) : 50;
        const volR = globalLeads > 0 ? Math.min(100, (stats.totalLeads / globalLeads) * 500) : 0;
        const score = Math.round(cplR * 0.35 + ctrR * 0.25 + volR * 0.20 + 50 * 0.20);
        return { id: ad.ad_id, nome: ad.ad_name || ad.ad_id, ...stats, count: score, status: ad.status, adset_id: ad.adset_id, campaign_id: ad.campaign_id };
      }).filter((r) => r.spend > 0 || r.totalLeads > 0);
    }

    rawRows.sort((a, b) => {
      const va = (a as unknown as Record<string, number>)[sortCol] ?? 0;
      const vb = (b as unknown as Record<string, number>)[sortCol] ?? 0;
      return sortDir === "asc" ? va - vb : vb - va;
    });

    return { rows: rawRows, globaMetrics: { globalSpend, globalLeads, globalCpl } };
  }, [metadata, performance, nivel, campanhaId, adsetId, sortCol, sortDir]);

  const abrirDetalhe = (ad: AnuncioDetalhe) => {
    setAnuncioSelecionado(ad);
    setTabAtiva("leads");
  };

  const gerarNovoCopy = async () => {
    const c = modalData?.criativo as Record<string, unknown> | null;
    if (!c) return;
    setAnalisandoIA(true);
    try {
      const res = await fetch("/api/ia/analisar-criativo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criativo_id: (c as { id: string }).id }),
      });
      const resJson = await res.json();
      if (resJson.error) toast.error(resJson.error);
      else {
        toast.success("Análise Cognitiva Concluída via IA");
        mutateModal(); // Pillar 2: Atualização assíncrona otimista
      }
    } catch { toast.error("Interrupção da IA conectiva."); }
    setAnalisandoIA(false);
  };

  const resolverAnomalia = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Muta opsticamente para resolver em tela enquanto chama backend (Pilar 2)
    if (modalData?.anomalias) {
      mutateModal({ ...modalData, anomalias: modalData.anomalias.map((a: any) => a.id === id ? { ...a, resolvida: true } : a) }, false);
    }
    await fetch("/api/marketing/anomalias", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    toast.success("Anomalia registrada como resolvida com sucesso.");
    mutateModal();
  };

  const campanhaNome = campanhaId ? metadata.find((m) => m.campaign_id === campanhaId)?.campaign_name || campanhaId : "";
  const adsetNome = adsetId ? metadata.find((m) => m.adset_id === adsetId)?.adset_name || adsetId : "";

  const leadsFiltrados = useMemo(() => {
    if (!modalData?.leads) return [];
    let lds = modalData.leads;
    if (filtroLeadStatus !== "all") lds = lds.filter((l: any) => l.etapa === filtroLeadStatus);

    // Calculates specific ad spend based on performance inside modal
    const adPerfs = performance.filter((p) => p.ad_id === anuncioSelecionado?.ad_id);
    const adSpend = adPerfs.reduce((s, p) => s + Number(p.spend), 0);
    const totalLeadsAd = modalData.leads.length;
    const custo = totalLeadsAd > 0 ? adSpend / totalLeadsAd : 0;

    return lds.map((l: any) => ({ ...l, custo_estimado: custo }));
  }, [modalData, filtroLeadStatus, performance, anuncioSelecionado]);

  if (loading && !metadata.length) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 animate-in fade-in zoom-in">
      <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
      <p className="text-muted-foreground text-sm font-medium animate-pulse">Sincronizando arquitetura global de dados Ads do Meta API...</p>
    </div>
  );

  const nivelLabel = nivel === "campanhas" ? "Campanhas" : nivel === "conjuntos" ? "Conjuntos" : "Anúncios";
  const columns = nivel === "anuncios"
    ? [{ key: "nome", label: "Peça Publicitária" }, { key: "spend", label: "Investido" }, { key: "totalLeads", label: "Leads" }, { key: "cpl", label: "CPL Atual" }, { key: "impressoes", label: "Audiência (Imp.)" }, { key: "ctr", label: "Engajamento CTR" }, { key: "count", label: "Vigor Neural" }]
    : [{ key: "nome", label: nivelLabel.slice(0, -1) }, { key: "spend", label: "Investido" }, { key: "totalLeads", label: "Leads" }, { key: "cpl", label: "CPL Atual" }, { key: "impressoes", label: "Audiência (Imp.)" }, { key: "ctr", label: "Engajamento CTR" }, { key: "count", label: "N° Anúncios Anexos" }];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          {nivel !== "campanhas" && (
            <button onClick={voltar} className="flex flex-col items-center justify-center p-2 rounded-xl bg-muted/20 border border-border/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all shrink-0">
              <ChevronLeft size={16} />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-black tracking-tight" style={{ letterSpacing: "-0.04em" }}>Arquitetura de Ad-Sets</h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-medium uppercase tracking-widest">
              <button onClick={() => { setNivel("campanhas"); setCampanhaId(null); setAdsetId(null); }} className={`transition-colors hover:text-primary ${nivel === "campanhas" ? "text-primary font-bold" : ""}`}>Campanhas Base</button>
              {campanhaId && (
                <>
                  <ChevronRight size={10} className="text-muted-foreground/40" />
                  <button onClick={() => { setNivel("conjuntos"); setAdsetId(null); }} className={`max-w-[200px] truncate transition-colors hover:text-primary ${nivel === "conjuntos" ? "text-primary font-bold" : ""}`} title={campanhaNome}>{campanhaNome}</button>
                </>
              )}
              {adsetId && (
                <>
                  <ChevronRight size={10} className="text-muted-foreground/40" />
                  <span className="text-foreground font-bold max-w-[200px] truncate" title={adsetNome}>{adsetNome}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Pilares 3: Bento Grid Cards na Tela de Estrutura */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card/40 backdrop-blur border-emerald-500/10 shadow-sm"><CardContent className="p-4 flex items-center justify-between"><div className="flex flex-col"><p className="text-[10px] uppercase font-bold tracking-widest text-emerald-500 mb-0.5">Budget Restrito Investido</p><p className="text-2xl font-black">{formatCurrency(globaMetrics.globalSpend)}</p></div><BadgeDollarSignIcon size={28} className="text-emerald-500/20" /></CardContent></Card>
          <Card className="bg-card/40 backdrop-blur border-blue-500/10 shadow-sm"><CardContent className="p-4 flex items-center justify-between"><div className="flex flex-col"><p className="text-[10px] uppercase font-bold tracking-widest text-blue-500 mb-0.5">Captura CRM Sincronizada</p><p className="text-2xl font-black">{globaMetrics.globalLeads} Leads</p></div><UsersIcon size={28} className="text-blue-500/20" /></CardContent></Card>
          <Card className="bg-card/40 backdrop-blur border-accent/10 shadow-sm"><CardContent className="p-4 flex items-center justify-between"><div className="flex flex-col"><p className="text-[10px] uppercase font-bold tracking-widest text-accent mb-0.5">Health Score CPL</p><p className="text-2xl font-black">{formatCurrency(globaMetrics.globalCpl)} / Lead</p></div><Activity size={28} className="text-accent/20" /></CardContent></Card>
        </div>

        {/* Period selector is now in the layout */}
      </div>

      <Card className="overflow-hidden border-border/40 shadow-xl bg-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/10 border-b border-border/60">
                  {columns.map((col) => (
                    <th key={col.key} onClick={() => toggleSort(col.key)} className="px-4 py-3 font-semibold text-left cursor-pointer hover:bg-muted/30 transition-colors whitespace-nowrap text-[10px] uppercase tracking-widest text-muted-foreground group">
                      <div className="flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown size={10} className={`text-muted-foreground/30 group-hover:text-foreground transition-colors ${sortCol === col.key ? "text-primary" : ""}`} />
                      </div>
                    </th>
                  ))}
                  {nivel === "anuncios" && <th className="px-4 py-3 font-semibold text-center text-[10px] uppercase tracking-widest text-muted-foreground">Monitoria Status</th>}
                  {nivel === "anuncios" && <th className="px-4 py-3 font-semibold text-right text-[10px] uppercase tracking-widest text-muted-foreground">Inspect</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`group hover:bg-muted/10 transition-colors ${nivel !== "anuncios" ? "cursor-pointer" : ""}`}
                    onClick={() => {
                      if (nivel === "campanhas") drillCampanha(row.id);
                      else if (nivel === "conjuntos") drillAdset(row.id);
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-xs max-w-[280px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate flex-1 font-semibold group-hover:text-primary transition-colors">{row.nome}</span>
                        {nivel === "campanhas" && funilMap.get(row.id)?.tipo_funil && <FunilBadge tipo={funilMap.get(row.id)!.tipo_funil} size="xs" />}
                        {nivel === "campanhas" && <FunilCampanhaPopover campaignId={row.id} campaignName={row.nome} currentTipo={funilMap.get(row.id)?.tipo_funil} />}
                        {nivel !== "anuncios" && <ChevronRight size={14} className="text-muted-foreground/40 shrink-0 group-hover:text-foreground group-hover:translate-x-1 transition-all" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono opacity-80">{formatCurrency(row.spend)}</td>
                    <td className="px-4 py-3 text-xs font-bold text-foreground">
                      <Badge className="bg-blue-500/10 text-blue-400 font-bold border-transparent pointer-events-none hover:bg-blue-500/20">{row.totalLeads}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">
                      <span className={`${row.cpl > globaMetrics.globalCpl * 1.5 ? "text-rose-400 font-bold" : "opacity-80"}`}>{row.totalLeads > 0 ? formatCurrency(row.cpl) : "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-xs opacity-60 font-mono">{row.impressoes.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 text-xs font-mono">
                      <span className={`px-1.5 py-0.5 rounded-sm ${row.ctr >= 1.5 ? "bg-emerald-500/10 text-emerald-400" : row.ctr >= 0.8 ? "text-muted-foreground" : row.ctr > 0 ? "bg-accent/10 text-accent" : "opacity-40"}`}>{formatPercent(row.ctr)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {nivel === "anuncios" ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-background shadow-inner rounded-full overflow-hidden border border-border/50">
                            <div className={`h-full rounded-full transition-all duration-700 ${row.count >= 70 ? "bg-emerald-500" : row.count >= 40 ? "bg-yellow-500" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"}`} style={{ width: `${Math.min(row.count, 100)}%` }} />
                          </div>
                          <span className={`text-[10px] font-black ${row.count >= 70 ? "text-emerald-400" : row.count >= 40 ? "text-yellow-400" : "text-rose-400 font-bold"}`}>{row.count}</span>
                        </div>
                      ) : <Badge className="text-[10px] tracking-widest font-bold bg-muted/40 text-muted-foreground shadow-inner">{row.count} Nodes</Badge>}
                    </td>
                    {nivel === "anuncios" && (
                      <td className="px-4 py-3 text-center">
                        <Badge className={`text-[9px] uppercase tracking-widest ${row.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-muted/50 text-muted-foreground"}`}>
                          {row.status === "ACTIVE" ? "Ativo" : (row.status || "").replace(/_/g, " ")}
                        </Badge>
                      </td>
                    )}
                    {nivel === "anuncios" && (
                      <td className="px-4 py-3 text-right">
                        <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); abrirDetalhe({ ad_id: row.id, ad_name: row.nome, adset_id: row.adset_id || null, campaign_id: row.campaign_id || null }); }} className="p-1.5 bg-muted/50 border border-border/50 hover:bg-primary/20 hover:text-primary hover:border-primary/40 rounded-lg transition-colors inline-flex text-muted-foreground items-center justify-center shadow-sm">
                          <Eye size={14} />
                        </motion.button>
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={nivel === "anuncios" ? 9 : 7} className="text-center text-muted-foreground py-10 font-medium">Não há veiculação de ads parametrizada dentro das filtragens escolhidas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Detailed de Inspect do Anúncio */}
      <AnimatePresence>
        {anuncioSelecionado && (
          <Dialog open={!!anuncioSelecionado} onOpenChange={() => setAnuncioSelecionado(null)}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-card/95 backdrop-blur-xl border border-white/10 shadow-2xl p-0">
              <DialogHeader className="p-5 pb-3 border-b border-border/50 bg-muted/10 shrink-0">
                <DialogTitle className="text-base font-black truncate max-w-[85%] uppercase tracking-tight text-foreground/90">{anuncioSelecionado.ad_name}</DialogTitle>
                <p className="text-[10px] font-mono text-muted-foreground mt-1 tracking-widest">{anuncioSelecionado.ad_id}</p>
              </DialogHeader>

              {/* Apple-Style Segmented Picker */}
              <div className="flex items-center gap-1 p-2 bg-muted/10 shrink-0 border-b border-border/40 px-5">
                {(["leads", "criativo", "anomalias"] as TabAnuncio[]).map((tab) => {
                  let counterLabel = "";
                  if (tab === "leads") counterLabel = ` (${modalData?.leads?.length || 0})`;
                  if (tab === "anomalias" && modalData?.anomalias) {
                    const err = modalData.anomalias.filter((a: any) => !a.resolvida).length;
                    if (err > 0) counterLabel = ` (${err})`;
                  }

                  return (
                    <button key={tab} onClick={() => setTabAtiva(tab)}
                      className={`px-4 py-1.5 text-xs font-bold tracking-widest uppercase rounded-full transition-all duration-300 relative ${tabAtiva === tab ? "text-primary shadow-sm bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                      {tab} <span className="font-mono text-[9px] opacity-70">{counterLabel}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto w-full relative">
                {loadingDetalhe ? (
                  <div className="absolute inset-0 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-primary" /></div>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="p-5 h-full">
                    {tabAtiva === "leads" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs bg-muted/30 px-3 py-1.5 rounded-xl border border-border/50">
                            <span className="font-semibold">{leadsFiltrados.length} Registros Mapeados</span>
                            <span className="w-px h-3 bg-border"></span>
                            <span className="font-mono text-muted-foreground opacity-90"><strong className="text-foreground">CPL Distribuído:</strong> {leadsFiltrados.length > 0 ? formatCurrency(leadsFiltrados[0].custo_estimado) : "—"}</span>
                          </div>
                          <select value={filtroLeadStatus} onChange={(e) => setFiltroLeadStatus(e.target.value)} className="text-xs bg-muted/30 focus:ring-1 focus:ring-primary border border-border/50 rounded-lg px-2 py-1 outline-none font-medium">
                            <option value="all">Todas Etapas Cadentes</option>
                            <option value="reuniao_agendada">Fase: Reunião (SDR)</option>
                            <option value="comprou">Status: Vitória Final</option>
                            <option value="desqualificado">Gargalo: Lixo Gerado</option>
                          </select>
                        </div>

                        <div className="border border-border/40 rounded-xl overflow-hidden bg-background">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-muted/20 border-b border-border/40 text-[9px] uppercase tracking-widest text-muted-foreground">
                              <th className="px-3 py-2 text-left font-bold">Identificação Civil</th>
                              <th className="px-3 py-2 text-center font-bold">Ponto Pipeline (CRM)</th>
                              <th className="px-3 py-2 text-left font-bold">Injeção temporal</th>
                              <th className="px-3 py-2 text-left font-bold">Target</th>
                              <th className="px-3 py-2 text-right font-bold w-[40px]">Linkagem</th>
                            </tr></thead>
                            <tbody className="divide-y divide-border/20">
                              {leadsFiltrados.map((l: any, i: number) => {
                                const corEtapa = l.etapa === "comprou" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : l.etapa.includes("reuniao") ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : l.etapa.includes("desqualificado") ? "bg-rose-500/15 text-rose-400 border-rose-500/30" : "bg-muted text-muted-foreground";
                                return (
                                  <tr key={i} className="hover:bg-muted/10 transition-colors group">
                                    <td className="px-3 py-2 font-semibold text-foreground/90">{l.nome || "Não preencheu na origem"}</td>
                                    <td className="px-3 py-2 text-center"><Badge className={`text-[8px] uppercase tracking-widest font-black ${corEtapa}`}>{l.etapa.replace(/_/g, " ")}</Badge></td>
                                    <td className="px-3 py-2 text-muted-foreground font-mono">{l.ghl_created_at ? new Date(l.ghl_created_at).toLocaleDateString("pt-BR") : "—"}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{l.area_atuacao || "—"}</td>
                                    <td className="px-3 py-2 text-right">
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-primary/20 bg-primary/5 text-primary opacity-50 cursor-default">
                                        <LinkIcon size={12} />
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                              {leadsFiltrados.length === 0 && <tr><td colSpan={5} className="text-center py-10 font-bold tracking-widest uppercase text-[10px] text-muted-foreground">Isolamento total: Nenhum lead cruzou para o funil</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {tabAtiva === "anomalias" && (
                      <div className="space-y-3">
                        {(!modalData?.anomalias || modalData.anomalias.length === 0) ? (
                          <div className="border border-dashed border-emerald-500/30 bg-emerald-500/5 rounded-2xl flex flex-col items-center justify-center p-12 text-emerald-500/70">
                            <CheckCircle size={32} className="mb-3 opacity-60" />
                            <p className="text-sm font-bold uppercase tracking-widest">Peça Estável</p>
                            <p className="text-xs font-mono mt-1 opacity-80">Nenhuma irregularidade computada nos algoritmos de gasto.</p>
                          </div>
                        ) : (
                          modalData.anomalias.map((ano: any) => {
                            const isError = ano.tipo.includes("gasto") || ano.tipo.includes("zerado") || ano.tipo.includes("queda");
                            const wrapperColor = ano.resolvida ? "border-border/30 bg-muted/10 opacity-60" : isError ? "border-rose-500/20 bg-rose-500/5" : "border-amber-500/20 bg-amber-500/5";
                            const badgeColor = ano.resolvida ? "bg-muted text-muted-foreground" : isError ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30";

                            return (
                              <div key={ano.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border transition-all ${wrapperColor}`}>
                                <div className="space-y-1.5 flex-1 pr-4">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={`text-[9px] uppercase tracking-widest font-black ${badgeColor}`}>{ano.tipo.replace(/_/g, " ")}</Badge>
                                    {ano.resolvida && <Badge className="text-[8px] uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">✓ Ticket Resolvido</Badge>}
                                  </div>
                                  <p className={`text-sm tracking-tight ${ano.resolvida ? "text-muted-foreground" : "text-foreground font-medium"}`}>{ano.causa_provavel}</p>
                                  <p className="text-[10px] text-muted-foreground font-mono">Flagrado em: {new Date(ano.criado_em).toLocaleString("pt-BR")}</p>
                                </div>
                                {!ano.resolvida && (
                                  <motion.button whileTap={{ scale: 0.95 }} className="mt-3 sm:mt-0 shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg bg-background border border-border/50 hover:bg-muted text-foreground transition-all flex items-center gap-1.5 shadow-sm" onClick={(e) => resolverAnomalia(ano.id, e)}>
                                    <CheckCircle size={14} className="text-emerald-500 opacity-80" /> Fechar Investigação
                                  </motion.button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {tabAtiva === "criativo" && (
                      <div className="h-full">
                        <p className="text-muted-foreground text-sm py-4 italic text-center border-t border-border mt-10 opacity-50">Área de Inteligência Criativa conectada via OpenAI provisionada via Backend SWR. Interface modular não afetada neste deploy.</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}

function UsersIcon({ size, className }: { size: number; className?: string }) { return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>; }
function BadgeDollarSignIcon({ size, className }: { size: number; className?: string }) { return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3.85 8.62 1.4 1.4M18.75 14l-1.4-1.4"></path><path d="M3.85 15.38 5.25 14M18.75 10l-1.4 1.4"></path><path d="M7 6h10C18.1 6 19 6.9 19 8v8c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V8c0-1.1.9-2 2-2Z"></path><path d="M12 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3Z"></path></svg>; }


